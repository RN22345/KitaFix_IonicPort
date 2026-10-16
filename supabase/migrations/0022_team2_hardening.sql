-- =============================================================================
-- KitaFix - migration 0022
-- Team 2 - Booking & Scheduling
-- Owner: Team 2 (rule R2: only Team 2 edits this file)
-- =============================================================================
--
-- WHY: the Supabase security advisor flagged three Team 2 objects. This
-- migration only tightens privileges and settings; no table, column, policy
-- or behaviour changes for signed-in customers. Safe to re-run.
--
--   1. t2_repairs_touch_updated_at had a role-mutable search_path.
--   2. get_taken_slots() could be called by anon. 0020 revoked it from PUBLIC,
--      but Supabase also grants EXECUTE on new public functions to anon and
--      authenticated directly, so anon kept access. Only signed-in customers
--      (the booking form) need it.
--   3. repairs_guard_customer_update() is a trigger function. Triggers fire
--      regardless of EXECUTE grants, so nobody needs to call it over the API.
--
-- Not changed here (other owners, rules R1/R5): is_staff(), my_role(),
-- current_user_no(), t1_stub_handle_new_user() (Team 1) and the btree_gist
-- extension in public (shared bootstrap).
-- =============================================================================

-- 1. Fixed search_path on the updated_at trigger function
alter function public.t2_repairs_touch_updated_at() set search_path = public, pg_temp;

-- 2. Free-slot lookup: signed-in users only
revoke execute on function public.get_taken_slots(text, date, uuid) from public, anon;
grant execute on function public.get_taken_slots(text, date, uuid) to authenticated;

-- 3. Guard trigger function: not callable over the API
revoke execute on function public.repairs_guard_customer_update() from public, anon, authenticated;
