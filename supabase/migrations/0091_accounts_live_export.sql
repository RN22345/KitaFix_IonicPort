-- =============================================================================
-- 0091_accounts_live_export.sql - Team 1 (Accounts), exported from hosted
-- =============================================================================
-- Team 1 built their database part by hand on the hosted project (2026-11)
-- instead of through migration files, and their repo files (old 0091-0096) no
-- longer matched what is live. This file replaces those files and 0098. It is
-- the live definitions copied from hosted (inspect-hosted.mjs --full,
-- 2026-11-27), so on hosted it is a no-op except for the two fixes below; on a
-- fresh database it builds the same thing.
--
-- Fixes on top of the live copy:
--   * admin_read_accounts: a switched-off admin could still list every account
--     (all other admin functions already check "active"). Now checks it too.
--   * avatars storage: two overlapping policy sets existed ("Users can ..." and
--     avatars_*). Kept one set with the same rules, plus a delete policy.
--
-- Not changed (see docs/Group_Merge.md, "Database audit"): profiles are
-- readable by every signed-in user (0024 policy), which now includes the
-- address / birthday / contact columns Team 1 added.
--
-- Run after 0024. Safe to re-run.
-- =============================================================================
begin;

-- 1) Profile columns ----------------------------------------------------------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists contact_no text,
  add column if not exists address text,
  add column if not exists birthday date,
  add column if not exists gender text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists account_no text;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'profiles_account_no_format'
                   and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_account_no_format
      check (account_no is null or account_no ~ '^[0-9]{8}$');
  end if;
end
$$;

create unique index if not exists profiles_account_no_key on public.profiles (account_no);

-- 2) Account number: YYMMDD + 2 random digits (Manila date) -------------------
create or replace function public.generate_account_no(for_date date default null)
returns text
language plpgsql
set search_path = ''
as $function$
declare
  base_date date := coalesce(for_date, (now() at time zone 'Asia/Manila')::date);
  day_offset integer := 0;
  day_part text;
  free_suffix text;
begin
  -- one at a time, so two signups can never get the same number
  perform pg_advisory_xact_lock(hashtext('profiles.account_no'));

  loop
    day_part := to_char(base_date + day_offset, 'YYMMDD');

    select lpad(n::text, 2, '0') into free_suffix
    from generate_series(0, 99) as n
    where not exists (
      select 1 from public.profiles p
      where p.account_no = day_part || lpad(n::text, 2, '0')
    )
    order by random()
    limit 1;

    if free_suffix is not null then
      return day_part || free_suffix;
    end if;

    -- all 100 numbers of that day are used: continue with the next day
    day_offset := day_offset + 1;
  end loop;
end;
$function$;
revoke all on function public.generate_account_no(date) from public, anon, authenticated;

create or replace function public.set_account_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.account_no is not null then
      new.account_no := old.account_no;
    end if;
  end if;

  if new.account_no is null then
    new.account_no := public.generate_account_no();
  end if;

  return new;
end;
$function$;
revoke all on function public.set_account_no() from public, anon, authenticated;

drop trigger if exists profiles_account_no on public.profiles;
create trigger profiles_account_no
  before insert or update on public.profiles
  for each row execute function public.set_account_no();

-- Give older rows a number (one row per statement, so numbers never clash).
do $$
declare r record;
begin
  for r in select id from public.profiles where account_no is null loop
    update public.profiles set updated_at = updated_at where id = r.id;
  end loop;
end
$$;

-- 3) Sign-up: fill Team 1's columns from the sign-up form ---------------------
-- Team 1 rewrote the body of the 0001 stub on hosted; this is that body.
create or replace function public.t1_stub_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    metadata jsonb;
begin
    metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);

    insert into public.profiles (
        id, first_name, last_name, full_name, contact_no, phone,
        address, birthday, gender, role
    )
    values (
        new.id,
        nullif(metadata ->> 'first_name', ''),
        nullif(metadata ->> 'last_name', ''),
        coalesce(
            nullif(metadata ->> 'full_name', ''),
            split_part(coalesce(new.email, ''), '@', 1)
        ),
        nullif(metadata ->> 'contact_no', ''),
        nullif(metadata ->> 'contact_no', ''),
        nullif(metadata ->> 'address', ''),
        nullif(metadata ->> 'birthday', '')::date,
        nullif(metadata ->> 'gender', ''),
        'customer'
    )
    on conflict (id) do nothing;

    return new;
end;
$function$;

-- 4) Terms acceptance (Signup) -------------------------------------------------
create or replace function public.record_terms_acceptance(accepted_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  accepted_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if accepted_version is null or length(trim(accepted_version)) = 0 then
    raise exception 'Terms version required';
  end if;

  update public.profiles
  set terms_accepted_at = now(),
      terms_version = trim(accepted_version)
  where id = auth.uid()
  returning terms_accepted_at into accepted_at;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return accepted_at;
end;
$function$;
revoke all on function public.record_terms_acceptance(text) from public, anon;
grant execute on function public.record_terms_acceptance(text) to authenticated;

-- 5) Deactivate own account (My Account) ---------------------------------------
create or replace function public.deactivate_own_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Don't let the last active admin lock everyone out
  if exists (select 1 from profiles where id = auth.uid() and role = 'admin')
     and (select count(*) from profiles where role = 'admin' and active = true) <= 1 then
    raise exception 'last_admin';
  end if;

  update profiles set active = false where id = auth.uid();

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;
revoke all on function public.deactivate_own_account() from public, anon;
grant execute on function public.deactivate_own_account() to authenticated;

-- 6) Admin: read accounts (Accounts list / profile) ---------------------------
create or replace function public.admin_read_accounts(account_id uuid default null)
returns table(id uuid, account_no text, first_name text, last_name text, full_name text,
              email text, contact_no text, address text, birthday text, gender text,
              avatar_url text, joined_at timestamptz, role text, active boolean,
              profile_exists boolean)
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if not exists (
        select 1
        from public.profiles as caller_profile
        where caller_profile.id = auth.uid()
          and caller_profile.role = 'admin'::public.user_role
          and caller_profile.active is true   -- fix: was missing on hosted
    ) then
        raise exception 'Admin access required';
    end if;

    return query
    select
        u.id,
        p.account_no::text,
        coalesce(
            nullif(trim(coalesce(p.first_name, '')), ''),
            nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), '')
        )::text as first_name,
        coalesce(
            nullif(trim(coalesce(p.last_name, '')), ''),
            nullif(regexp_replace(trim(coalesce(p.full_name, '')), '^\S+\s*', ''), '')
        )::text as last_name,
        p.full_name::text,
        u.email::text,
        coalesce(nullif(p.contact_no, ''), p.phone)::text as contact_no,
        p.address::text,
        p.birthday::text,
        p.gender::text,
        p.avatar_url::text,
        u.created_at as joined_at,
        p.role::text,
        p.active,
        (p.id is not null) as profile_exists
    from auth.users as u
    left join public.profiles as p
        on p.id = u.id
    where $1 is null or u.id = $1
    order by u.created_at desc;
end;
$function$;
revoke all on function public.admin_read_accounts(uuid) from public, anon;
grant execute on function public.admin_read_accounts(uuid) to authenticated;

-- 7) Admin: change role (technicians list is kept in step by 0097's trigger) ---
create or replace function public.admin_assign_account_role(account_id uuid, new_role public.user_role)
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $function$
declare
    caller_id uuid;
begin
    caller_id := auth.uid();

    if caller_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.profiles as p
        where p.id = caller_id
          and p.role = 'admin'::public.user_role
          and p.active is true
    ) then
        raise exception 'Active admin access required'
            using errcode = '42501';
    end if;

    if account_id = caller_id then
        raise exception 'You cannot change your own role'
            using errcode = '42501';
    end if;

    if new_role is null then
        raise exception 'A valid role is required';
    end if;

    update public.profiles as p
    set
        role = new_role,
        updated_at = now()
    where p.id = account_id;

    if not found then
        raise exception 'Account profile not found'
            using errcode = 'P0002';
    end if;

    return new_role;
end;
$function$;
revoke all on function public.admin_assign_account_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_assign_account_role(uuid, public.user_role) to authenticated;

-- 8) Admin: switch an account on/off ------------------------------------------
create or replace function public.admin_set_account_active(account_id uuid, new_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller uuid := auth.uid();
begin
  -- Only an active Admin may use this
  if caller is null or not exists (
    select 1 from public.profiles
    where id = caller and role::text = 'admin' and active = true
  ) then
    raise exception 'Active Admin access is required' using errcode = '42501';
  end if;

  -- An Admin can't change their own status
  if account_id = caller then
    raise exception 'You cannot change your own active status' using errcode = '42501';
  end if;

  update public.profiles set active = new_active where id = account_id;

  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;

  return new_active;
end;
$function$;
revoke all on function public.admin_set_account_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_account_active(uuid, boolean) to authenticated;

-- 9) Profile pictures (bucket + own-folder policies) --------------------------
-- Storage is owned by Supabase's own role; if this role may not change it, keep
-- what is there (hosted already has it) instead of failing the whole file.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 512000, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  drop policy if exists "Users can update own avatar" on storage.objects;
  drop policy if exists "Users can upload own avatar" on storage.objects;
  drop policy if exists "Users delete own avatar" on storage.objects;

  drop policy if exists avatars_select_own on storage.objects;
  create policy avatars_select_own on storage.objects for select to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists avatars_insert_own on storage.objects;
  create policy avatars_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists avatars_update_own on storage.objects;
  create policy avatars_update_own on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists avatars_delete_own on storage.objects;
  create policy avatars_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception
  when insufficient_privilege then
    raise notice 'avatars storage left unchanged (no permission on storage): %', sqlerrm;
end
$$;

commit;
