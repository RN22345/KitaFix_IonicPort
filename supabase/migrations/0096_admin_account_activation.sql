-- MANUAL: review and deploy as postgres after 0092-0095. NOT applied by Angular.
-- Only Accounts objects change. Auth users/sessions and existing policies remain.
begin;

do $$ begin
  if to_regprocedure('public.admin_read_accounts(uuid)') is null
    or to_regprocedure('public.admin_assign_account_role(uuid,text)') is null
    or not exists (select 1 from pg_trigger t join pg_proc f on f.oid = t.tgfoid
      where t.tgrelid = 'public.profiles'::regclass
        and t.tgname = 'protect_profile_account_access' and t.tgenabled in ('O', 'A')
        and t.tgfoid = to_regprocedure('public.protect_profile_account_access()')
        and (t.tgtype & 23) = 23 and not f.prosecdef) then
    raise exception 'Inspect/deploy Accounts 0092-0094 and the protected profile trigger first';
  end if;
end $$;

create or replace function public.admin_set_account_active(account_id uuid, new_active boolean)
returns boolean
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  caller_id uuid := auth.uid();
  saved_active boolean;
begin
  if caller_id is null or not exists (
    select 1 from public.profiles p
    where p.id = caller_id and p.role::text = 'admin' and p.active is true
  ) then
    raise exception 'Active Admin access required' using errcode = '42501';
  end if;
  if account_id = caller_id then
    raise exception 'You cannot change your own active status' using errcode = '42501';
  end if;
  if account_id is null or new_active is null then
    raise exception 'Account UUID and active status are required' using errcode = '22023';
  end if;

  -- Same lock order as role assignment. Revalidate after concurrent changes.
  perform p.id from public.profiles p
    where p.id in (caller_id, account_id) order by p.id for update;
  if not exists (select 1 from public.profiles p
    where p.id = caller_id and p.role::text = 'admin' and p.active is true) then
    raise exception 'Active Admin access required' using errcode = '42501';
  end if;
  update public.profiles p set active = new_active
    where p.id = account_id and exists (select 1 from auth.users u where u.id = p.id)
    returning p.active into saved_active;
  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;
  return saved_active;
end;
$$;
alter function public.admin_set_account_active(uuid, boolean) owner to postgres;
revoke all on function public.admin_set_account_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_account_active(uuid, boolean) to authenticated;

-- No caller-supplied UUID: answers only for the current JWT identity. Definer
-- avoids recursive profiles RLS checks; JWT role/metadata are never trusted.
create or replace function public.accounts_caller_is_active()
returns boolean language sql stable security definer
set search_path = pg_catalog
as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.active is true);
$$;
alter function public.accounts_caller_is_active() owner to postgres;
revoke all on function public.accounts_caller_is_active() from public, anon, authenticated;
grant execute on function public.accounts_caller_is_active() to authenticated;

-- Restrictive policies intersect existing permissive policies, never grant
-- ownership/access on their own, and preserve every existing named policy.
-- Own SELECT remains available for login/guards to detect inactive accounts.
-- Admin RPCs bypass RLS as postgres but explicitly validate the active Admin.
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
    and policyname = 'accounts_active_select') then
    create policy accounts_active_select on public.profiles as restrictive
      for select to authenticated using (id = auth.uid() or public.accounts_caller_is_active());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
    and policyname = 'accounts_active_update') then
    create policy accounts_active_update on public.profiles as restrictive
      for update to authenticated
      using (public.accounts_caller_is_active()) with check (public.accounts_caller_is_active());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
    and policyname = 'accounts_active_insert') then
    create policy accounts_active_insert on public.profiles as restrictive
      for insert to authenticated with check (public.accounts_caller_is_active());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
    and policyname = 'accounts_active_delete') then
    create policy accounts_active_delete on public.profiles as restrictive
      for delete to authenticated using (public.accounts_caller_is_active());
  end if;
end $$;

-- Registration's postgres-owned Auth trigger remains able to create profiles.
-- No Auth admin calls, session revocation, role changes, deletes or data backfill.
commit;
