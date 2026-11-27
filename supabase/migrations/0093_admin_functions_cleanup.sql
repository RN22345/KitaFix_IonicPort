-- =============================================================================
-- 0093_admin_functions_cleanup.sql - one set of admin account functions
-- =============================================================================
-- Two sets did the same two jobs:
--   0024: set_user_role / set_user_active        (no caller in the app)
--   0091: admin_assign_account_role / admin_set_account_active (Team 1 screens)
-- The group kept Team 1's set (decision 27 Nov). This file:
--   1. drops the unused 0024 pair, so there is one door to change roles/status;
--   2. admin_set_account_active now also sets updated_at (like the role one);
--   3. plainer error messages. The error CODES are unchanged (42501 denied,
--      P0002 not found): Team 1's screens map those codes to their own text,
--      so nothing changes in the app. Same names, arguments and return types.
-- Keeping public.technicians in step with the role is 0097's trigger.
--
-- Run after 0091. Safe to re-run.
-- =============================================================================
begin;

drop function if exists public.set_user_role(uuid, public.user_role);
drop function if exists public.set_user_active(uuid, boolean);

create or replace function public.admin_assign_account_role(account_id uuid, new_role public.user_role)
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $function$
declare
    caller_id uuid := auth.uid();
begin
    if caller_id is null then
        raise exception 'Please sign in first.' using errcode = '42501';
    end if;

    if not exists (
        select 1 from public.profiles as p
        where p.id = caller_id
          and p.role = 'admin'::public.user_role
          and p.active is true
    ) then
        raise exception 'Only an active admin can change roles.' using errcode = '42501';
    end if;

    if account_id = caller_id then
        raise exception 'You cannot change your own role.' using errcode = '42501';
    end if;

    if new_role is null then
        raise exception 'Choose a role.' using errcode = '22023';
    end if;

    update public.profiles as p
    set role = new_role,
        updated_at = now()
    where p.id = account_id;

    if not found then
        raise exception 'No such account.' using errcode = 'P0002';
    end if;

    return new_role;
end;
$function$;
revoke all on function public.admin_assign_account_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_assign_account_role(uuid, public.user_role) to authenticated;

create or replace function public.admin_set_account_active(account_id uuid, new_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
    caller_id uuid := auth.uid();
begin
    if caller_id is null or not exists (
        select 1 from public.profiles as p
        where p.id = caller_id
          and p.role = 'admin'::public.user_role
          and p.active is true
    ) then
        raise exception 'Only an active admin can turn accounts on or off.' using errcode = '42501';
    end if;

    if account_id = caller_id then
        raise exception 'You cannot turn your own account on or off.' using errcode = '42501';
    end if;

    update public.profiles as p
    set active = new_active,
        updated_at = now()          -- was missing
    where p.id = account_id;

    if not found then
        raise exception 'No such account.' using errcode = 'P0002';
    end if;

    return new_active;
end;
$function$;
revoke all on function public.admin_set_account_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_account_active(uuid, boolean) to authenticated;

commit;
