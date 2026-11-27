-- =============================================================================
-- 0099_technicians_backfill.sql - bookable technicians follow the profile
-- =============================================================================
-- 0097's trigger keeps public.technicians in step only when a role CHANGES
-- after 0097 was applied. Every technician promoted before that (all three on
-- hosted, 27 Nov) has no active technicians row, so the Book page's
-- technician picker is empty and repairs cannot be assigned to them.
--
-- 1. Backfill: one technicians row per profile; active = role is technician
--    and the account is switched on.
-- 2. The trigger now also fires when an account is switched on/off (Team 1's
--    admin_set_account_active), so a switched-off technician is not bookable.
--
-- Run after 0097. Safe to re-run.
-- =============================================================================
begin;

insert into public.technicians (profile_id, active)
select p.id, p.active
  from public.profiles p
 where p.role = 'technician'
on conflict (profile_id) do update
   set active = excluded.active, updated_at = now()
 where public.technicians.active is distinct from excluded.active;

update public.technicians t
   set active = false, updated_at = now()
  from public.profiles p
 where p.id = t.profile_id and p.role <> 'technician' and t.active;

create or replace function public.sync_technician_from_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'technician' then
    insert into public.technicians (profile_id, active) values (new.id, new.active)
      on conflict (profile_id) do update set active = excluded.active, updated_at = now();
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
  after update of role, active on public.profiles
  for each row when (new.role is distinct from old.role or new.active is distinct from old.active)
  execute function public.sync_technician_from_role();

commit;
