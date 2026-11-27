-- =============================================================================
-- KitaFix - migration 0025
-- Team 2 - Booking & Scheduling
-- Owner: Team 2 (rule R2: only Team 2 edits this file)
-- =============================================================================
--
-- Performance only, no behaviour change (Supabase advisor follow-up).
--
-- 1. RLS: the repairs_*_own policies called auth.uid() once per row. Wrapped
--    as (select auth.uid()), Postgres evaluates it once per statement
--    (advisor lint 0003 auth_rls_initplan). Same rule: customer_id = me.
--
-- 2. Indexes on the three foreign keys that had none (advisor lint 0001
--    unindexed_foreign_keys). Deleting a service or technician, and the
--    Team 3 / Team 4 joins and reports, no longer scan the whole table.
-- =============================================================================

alter policy repairs_select_own on public.repairs
  using (customer_id = (select auth.uid()));

alter policy repairs_insert_own on public.repairs
  with check (customer_id = (select auth.uid()));

alter policy repairs_update_own on public.repairs
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create index if not exists repairs_service_idx on public.repairs (service_id);
create index if not exists repairs_technician_idx on public.repairs (technician_id);
create index if not exists repairs_confirmed_by_idx on public.repairs (confirmed_by);
