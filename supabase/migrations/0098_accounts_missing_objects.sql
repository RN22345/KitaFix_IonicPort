-- =============================================================================
-- 0098_accounts_missing_objects.sql - integration fix (after the group merge)
-- =============================================================================
-- Team 1's app code uses three things that no migration created:
--   * Storage bucket 'avatars'   (Edit Profile / Signup picture upload + remove)
--   * rpc record_terms_acceptance(accepted_version)  (Signup)
--   * rpc deactivate_own_account()                   (My Account)
-- Shapes follow libs/accounts/src/lib/services/accounts-auth.ts:
--   avatar path '<auth uid>/avatar', read through getPublicUrl (public bucket);
--   deactivate returns true, and its error mentions 'last_admin' when the caller
--   is the only active admin.
-- Team 1: replace this with your own version if you already have one.
-- Run after 0091-0097. Safe to re-run.
-- =============================================================================
begin;

-- 1) Profile pictures --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Public read comes from the bucket being public. Writes: only your own folder.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- upsert: true needs to see the existing object.
drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2) Terms acceptance --------------------------------------------------------
alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.record_terms_acceptance(accepted_version text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  if accepted_version is null or length(trim(accepted_version)) = 0 or length(accepted_version) > 50 then
    raise exception 'Invalid terms version.' using errcode = '22023';
  end if;
  update public.profiles
     set terms_version = trim(accepted_version), terms_accepted_at = now()
   where id = auth.uid();
end
$$;
revoke all on function public.record_terms_acceptance(text) from public, anon;
grant execute on function public.record_terms_acceptance(text) to authenticated;

-- 3) Deactivate own account ----------------------------------------------------
create or replace function public.deactivate_own_account()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  caller_role public.user_role;
begin
  if caller is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;

  select role into caller_role from public.profiles where id = caller and active for update;
  if not found then
    raise exception 'Account not found or already inactive.' using errcode = 'P0002';
  end if;

  if caller_role = 'admin' and not exists (
    select 1 from public.profiles where role = 'admin' and active and id <> caller
  ) then
    raise exception 'last_admin: make another admin first' using errcode = '42501';
  end if;

  update public.profiles set active = false where id = caller;
  return true;
end
$$;
revoke all on function public.deactivate_own_account() from public, anon;
grant execute on function public.deactivate_own_account() to authenticated;

commit;
