-- =============================================================================
-- 0094_public_reviews.sql - anonymous reviews for customers (Team 2 reads
-- Team 4's public.reviews; Team 4's table, rules and admin screens unchanged)
-- =============================================================================
-- Team 4's reviews are private by design: a customer sees only their own, an
-- admin sees all (with names). Customers choosing a shop or technician should
-- still see what others thought, so these two functions return reviews WITHOUT
-- anything that identifies the customer: no customer id or name, no repair id,
-- no device. What is shown: stars, the comment, the shop's reply, dates, the
-- service and the technician (staff names are visible to customers anyway).
--
--   get_public_reviews(p_limit)  newest reviews, anonymous (Home page)
--   get_technician_ratings()     average stars + count per technician
--                                (technician picker in New Booking)
--
-- Security definer, so they can read reviews past Team 4's own-row RLS; they
-- only ever return the columns listed here. Signed-in users only.
-- Run after 0040. Safe to re-run.
-- =============================================================================
begin;

create or replace function public.get_public_reviews(p_limit integer default 6)
returns table (
  id uuid,
  rating smallint,
  comment text,
  reply_text text,
  created_at timestamptz,
  replied_at timestamptz,
  service_name text,
  technician_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select rv.id, rv.rating, rv.comment, rv.reply_text, rv.created_at, rv.replied_at,
         s.name, p.full_name
  from public.reviews rv
  join public.repairs r on r.id = rv.repair_id
  left join public.services s on s.id = r.service_id
  left join public.technicians t on t.id = r.technician_id
  left join public.profiles p on p.id = t.profile_id
  order by rv.created_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;
revoke all on function public.get_public_reviews(integer) from public, anon;
grant execute on function public.get_public_reviews(integer) to authenticated;

create or replace function public.get_technician_ratings()
returns table (technician_id uuid, review_count integer, average_rating numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select r.technician_id, count(*)::integer, round(avg(rv.rating), 1)
  from public.reviews rv
  join public.repairs r on r.id = rv.repair_id
  where r.technician_id is not null
  group by r.technician_id;
$$;
revoke all on function public.get_technician_ratings() from public, anon;
grant execute on function public.get_technician_ratings() to authenticated;

commit;
