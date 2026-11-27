-- MANUAL: review and deploy as postgres after 0092 and 0093.
-- Not deployed by Angular. Only updates the selected profile's application role.
begin;

do $$ begin
  if to_regprocedure('public.admin_read_accounts(uuid)') is null
    or not exists (select 1 from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'protect_profile_account_access' and tgenabled = 'O') then
    raise exception 'Inspect registration protection and deploy migration 0093 first';
  end if;
end $$;

create or replace function public.admin_assign_account_role(account_id uuid, new_role text)
returns text
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  caller_id uuid := auth.uid();
  assigned_role public.profiles.role%type;
  saved_role text;
begin
  -- Reject unauthorized callers before inspecting target existence/inputs.
  if caller_id is null or not exists (
    select 1 from public.profiles p
    where p.id = caller_id and p.role::text = 'admin' and p.active is true
  ) then
    raise exception 'Active Admin access required' using errcode = '42501';
  end if;
  if account_id = caller_id then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('admin', 'technician', 'customer') then
    raise exception 'Invalid application role' using errcode = '22023';
  end if;

  -- Serialize changes involving the caller/target in UUID order. Recheck after
  -- locking so concurrent demotion/deactivation cannot authorize a stale Admin.
  perform p.id from public.profiles p
    where p.id in (caller_id, account_id) order by p.id for update;
  if not exists (select 1 from public.profiles p
    where p.id = caller_id and p.role::text = 'admin' and p.active is true) then
    raise exception 'Active Admin access required' using errcode = '42501';
  end if;

  -- PL/pgSQL assignment uses the existing column type (enum or constrained text).
  assigned_role := new_role;
  update public.profiles p set role = assigned_role
    where p.id = account_id and exists (select 1 from auth.users u where u.id = p.id)
    returning p.role::text into saved_role;
  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;
  return saved_role;
end;
$$;

alter function public.admin_assign_account_role(uuid, text) owner to postgres;
revoke all on function public.admin_assign_account_role(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_assign_account_role(uuid, text) to authenticated;
commit;
