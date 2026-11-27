-- =============================================================================
-- 0040_team4_insights.sql  -  Team 4: Feedback & Insights
-- =============================================================================
-- Owns : public.reviews + 3 report views.
-- Uses : public.repairs (Team 2/3), public.profiles + public.technicians
--        (Team 1), is_admin() / my_role() (Team 1 helpers: called, never edited).
--        Roles after migration 0024: customer | technician | admin (staff merged into admin).
-- Rules implemented (FSD v2.0):
--   1.1  Customer reviews only their OWN repair
--   1.3  Only a repair with status 'completed' can be reviewed
--   1.4  One review per repair (UNIQUE repair_id)
--   1.5  Rating 1-5 required, comment optional (max 200 chars)
--   1.6  One staff reply per review (reply_text, replied_by, replied_at)
--   1.7  created_at / updated_at timestamps
--   1.8  Customer may edit rating/comment only within 1 hour of created_at
--   1.9  Customer may delete only within 1 hour; admin may delete any time
--   3.x  v_repair_status_summary, v_technician_performance, v_review_summary
-- Safe to re-run (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. reviews table
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  review_no   bigint generated always as identity,
  review_id   text generated always as ('RV-' || lpad(review_no::text, 5, '0')) stored,

  repair_id   uuid not null,
  customer_id uuid not null,

  rating      smallint not null,
  comment     text,

  reply_text  text,
  replied_by  uuid,
  replied_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint reviews_repair_id_key       unique (repair_id),
  constraint reviews_review_no_key       unique (review_no),
  constraint reviews_repair_id_fkey      foreign key (repair_id)   references public.repairs (id)  on delete cascade,
  constraint reviews_customer_id_fkey    foreign key (customer_id) references public.profiles (id) on delete cascade,
  constraint reviews_replied_by_fkey     foreign key (replied_by)  references public.profiles (id) on delete set null,
  constraint reviews_rating_range        check (rating between 1 and 5),
  constraint reviews_comment_max_200     check (comment is null or char_length(comment) <= 200),
  constraint reviews_reply_max_500       check (reply_text is null or char_length(reply_text) <= 500)
);

create index if not exists reviews_customer_idx on public.reviews (customer_id, created_at desc);
create index if not exists reviews_created_idx  on public.reviews (created_at desc);

comment on table  public.reviews is 'Team 4. One customer rating/comment per completed repair, plus one optional staff reply.';
comment on column public.reviews.review_id  is 'Display id, e.g. RV-00001 (computed from review_no).';
comment on column public.reviews.repair_id  is 'UNIQUE: a repair can only be reviewed once.';
comment on column public.reviews.replied_by is 'Staff profile that wrote the reply (set by trigger, not by the client).';

-- -----------------------------------------------------------------------------
-- 2. Triggers (business rules)
-- -----------------------------------------------------------------------------

-- 2a. Before INSERT: completed-only + own-repair-only, server-side timestamps.
create or replace function public.t4_reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.repair_status;
  v_owner  uuid;
begin
  select r.status, r.customer_id
    into v_status, v_owner
  from public.repairs r
  where r.id = new.repair_id;

  if not found then
    raise exception 'Repair not found.' using errcode = '23503';
  end if;

  if v_status <> 'completed' then
    raise exception 'Only a completed repair can be reviewed.' using errcode = '23514';
  end if;

  if v_owner is distinct from new.customer_id then
    raise exception 'You can only review your own repair.' using errcode = '42501';
  end if;

  -- A signed-in client can never pre-fill the staff reply or backdate a review.
  if auth.uid() is not null then
    new.reply_text := null;
    new.replied_by := null;
    new.replied_at := null;
  end if;

  new.comment    := nullif(btrim(new.comment), '');
  new.created_at := now();
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists t4_reviews_before_insert on public.reviews;
create trigger t4_reviews_before_insert
  before insert on public.reviews
  for each row execute function public.t4_reviews_before_insert();

-- 2b. Before UPDATE: 1-hour edit window (customer) and single reply (staff).
create or replace function public.t4_reviews_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- SQL editor / migrations / service_role have no customer session: allowed.
  if auth.uid() is null then
    return new;
  end if;

  if new.id          is distinct from old.id
     or new.review_no   is distinct from old.review_no
     or new.repair_id   is distinct from old.repair_id
     or new.customer_id is distinct from old.customer_id
     or new.created_at  is distinct from old.created_at then
    raise exception 'The repair, the author and the creation time of a review cannot be changed.'
      using errcode = '42501';
  end if;

  -- Admin: reply only. They never edit the customer's words.
  if (select public.is_admin()) then
    if new.rating is distinct from old.rating
       or new.comment is distinct from old.comment then
      raise exception 'An administrator cannot edit a customer review. They can reply to it or delete it.'
        using errcode = '42501';
    end if;

    if new.reply_text is distinct from old.reply_text then
      if old.reply_text is not null then
        raise exception 'This review already has a reply.' using errcode = '23505';
      end if;
      if nullif(btrim(new.reply_text), '') is null then
        raise exception 'A reply cannot be empty.' using errcode = '23514';
      end if;
      new.reply_text := btrim(new.reply_text);
      new.replied_by := auth.uid();
      new.replied_at := now();
    else
      new.replied_by := old.replied_by;
      new.replied_at := old.replied_at;
    end if;
    return new;
  end if;

  -- Customer: only the author, only rating/comment, only within 1 hour.
  if old.customer_id is distinct from auth.uid() then
    raise exception 'You can only edit your own review.' using errcode = '42501';
  end if;

  if new.reply_text is distinct from old.reply_text
     or new.replied_by is distinct from old.replied_by
     or new.replied_at is distinct from old.replied_at then
    raise exception 'Customers cannot change the staff reply.' using errcode = '42501';
  end if;

  if now() > old.created_at + interval '1 hour' then
    raise exception 'Editing is only allowed within 1 hour of submitting the review.'
      using errcode = '42501';
  end if;

  new.comment    := nullif(btrim(new.comment), '');
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists t4_reviews_before_update on public.reviews;
create trigger t4_reviews_before_update
  before update on public.reviews
  for each row execute function public.t4_reviews_before_update();

-- 2c. Before DELETE: customer within 1 hour; admin any time (clear message).
create or replace function public.t4_reviews_before_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.my_role() = 'admin' then
    return old;
  end if;

  if old.customer_id is distinct from auth.uid() then
    raise exception 'You can only delete your own review.' using errcode = '42501';
  end if;

  if now() > old.created_at + interval '1 hour' then
    raise exception 'This review can no longer be deleted by you. Ask an administrator to delete it.'
      using errcode = '42501';
  end if;

  return old;
end
$$;

drop trigger if exists t4_reviews_before_delete on public.reviews;
create trigger t4_reviews_before_delete
  before delete on public.reviews
  for each row execute function public.t4_reviews_before_delete();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
--    Postgres ORs policies together, so Team 2/3 policies on repairs and ours on
--    reviews never conflict.
-- -----------------------------------------------------------------------------
alter table public.reviews enable row level security;

-- Read: own reviews, or everything for an admin.
drop policy if exists reviews_select_own on public.reviews;
create policy reviews_select_own on public.reviews
  for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists reviews_select_admin on public.reviews;
create policy reviews_select_admin on public.reviews
  for select to authenticated
  using ((select public.is_admin()));

-- Create: only as yourself (the trigger checks repair owner + completed).
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (customer_id = auth.uid());

-- Update: author (1-hour rule in trigger) or admin (reply only, in trigger).
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews
  for update to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

drop policy if exists reviews_update_admin on public.reviews;
create policy reviews_update_admin on public.reviews
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Delete: author (1-hour rule in trigger) or admin (any time).
drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews
  for delete to authenticated
  using (customer_id = auth.uid());

drop policy if exists reviews_delete_admin on public.reviews;
create policy reviews_delete_admin on public.reviews
  for delete to authenticated
  using (public.my_role() = 'admin');

revoke all on public.reviews from anon;
grant select, insert, update, delete on public.reviews to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Report views (chart-ready). security_invoker = the caller's RLS applies,
--    so staff see everything and a customer only ever sees their own rows.
-- -----------------------------------------------------------------------------

-- 4a. Repairs per status (every status listed, even with 0 repairs).
create or replace view public.v_repair_status_summary
with (security_invoker = true) as
select
  s.status,
  count(r.id)::int as repair_count
from unnest(enum_range(null::public.repair_status)) as s(status)
left join public.repairs r on r.status = s.status
group by s.status
order by array_position(enum_range(null::public.repair_status), s.status);

-- 4b. Per technician: repairs handled, completed, review count, average rating.
--     Technicians with zero reviews still appear (average_rating is NULL).
create or replace view public.v_technician_performance
with (security_invoker = true) as
select
  t.id                                                          as technician_id,
  p.full_name                                                   as technician_name,
  count(distinct r.id)::int                                     as total_repairs,
  (count(distinct r.id) filter (where r.status = 'completed'))::int as completed_repairs,
  count(rv.id)::int                                             as review_count,
  round(avg(rv.rating), 2)                                      as average_rating
from public.technicians t
join public.profiles p        on p.id = t.profile_id
left join public.repairs r    on r.technician_id = t.id
left join public.reviews rv   on rv.repair_id = r.id
group by t.id, p.full_name;

-- 4c. Overall summary + star breakdown (always returns exactly one row).
create or replace view public.v_review_summary
with (security_invoker = true) as
select
  count(*)::int                                  as total_reviews,
  round(avg(rating), 2)                          as average_rating,
  (count(*) filter (where rating = 1))::int      as star_1,
  (count(*) filter (where rating = 2))::int      as star_2,
  (count(*) filter (where rating = 3))::int      as star_3,
  (count(*) filter (where rating = 4))::int      as star_4,
  (count(*) filter (where rating = 5))::int      as star_5
from public.reviews;

revoke all on public.v_repair_status_summary  from anon;
revoke all on public.v_technician_performance from anon;
revoke all on public.v_review_summary         from anon;
grant select on public.v_repair_status_summary  to authenticated;
grant select on public.v_technician_performance to authenticated;
grant select on public.v_review_summary         to authenticated;

comment on view public.v_repair_status_summary  is 'Team 4. Repairs grouped by status, for the status chart.';
comment on view public.v_technician_performance is 'Team 4. Per technician: total/completed repairs, review count, average rating.';
comment on view public.v_review_summary         is 'Team 4. Total reviews, average rating and 1-5 star counts.';
