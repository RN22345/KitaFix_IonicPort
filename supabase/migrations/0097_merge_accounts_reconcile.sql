-- =============================================================================
-- 0097_merge_accounts_reconcile.sql - group merge (Team 1 + Team 2 + Team 4)
-- =============================================================================
-- Team 1 (Group A) branched before 0024, so two things do not line up:
--
-- 1. 0024 lets a signed-in user UPDATE only (full_name, phone, avatar_url) on
--    their profile. Team 1's Edit Profile also writes first_name, last_name,
--    contact_no, address, birthday and gender (columns added in 0091), so
--    every save failed with 42501. Grant those columns too. role and active
--    stay out of the grant, so users cannot change them.
--
-- 2. 0024's set_user_role() keeps public.technicians in step with the role;
--    Team 1's admin_assign_account_role() (0091) does not, so a user promoted
--    from the Accounts screen never became a bookable technician. A trigger on
--    the role column covers both functions without editing either.
--
-- Run after 0091. Safe to re-run.
-- =============================================================================
begin;

grant update (first_name, last_name, contact_no, address, birthday, gender)
  on public.profiles to authenticated;

create or replace function public.sync_technician_from_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'technician' then
    insert into public.technicians (profile_id) values (new.id)
      on conflict (profile_id) do update set active = true, updated_at = now();
  else
    update public.technicians set active = false, updated_at = now()
     where profile_id = new.id and active;
  end if;
  return null;
end
$$;
revoke all on function public.sync_technician_from_role() from public, anon, authenticated;

drop trigger if exists sync_technician_from_role on public.profiles;
create trigger sync_technician_from_role
  after update of role on public.profiles
  for each row when (new.role is distinct from old.role)
  execute function public.sync_technician_from_role();

commit;
