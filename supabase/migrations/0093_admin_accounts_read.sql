-- MANUAL: needs deployment as postgres after deployed registration migration 0092.
-- Read only: no profile/Auth mutations, policy changes, or new grants on tables.
begin;

-- Fail before installing if the registration schema/protection is absent.
do $$ begin
  if to_regprocedure('public.accounts_create_signup_profile()') is null
    or not exists (select 1 from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'protect_profile_account_access' and tgenabled = 'O') then
    raise exception 'Inspect and deploy registration migration 0092 first';
  end if;
end $$;

create or replace function public.admin_read_accounts(account_id uuid default null)
returns table (
  id uuid, email text, first_name text, last_name text, full_name text,
  contact_no text, role text, active boolean, joined_at timestamptz,
  profile_exists boolean
)
language plpgsql stable security definer
set search_path = pg_catalog
as $$
begin
  -- Never trust JWT metadata for application authorization.
  if auth.uid() is null or not exists (
    select 1 from public.profiles caller
    where caller.id = auth.uid() and caller.role::text = 'admin'
      and caller.active is true
  ) then
    raise exception 'Active Admin access required' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text, p.first_name, p.last_name,
    -- Only use full_name when split names are absent; do not repeat last_name.
    case when nullif(btrim(p.first_name), '') is null
      and nullif(btrim(p.last_name), '') is null then p.full_name else null end,
    p.contact_no, p.role::text, p.active, u.created_at, p.id is not null
  from auth.users u
  left join public.profiles p on p.id = u.id
  where account_id is null or u.id = account_id
  order by u.created_at desc, u.id;
end;
$$;

alter function public.admin_read_accounts(uuid) owner to postgres;
revoke all on function public.admin_read_accounts(uuid) from public, anon, authenticated;
grant execute on function public.admin_read_accounts(uuid) to authenticated;
commit;
