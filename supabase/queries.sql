-- =============================================================================
-- KitaFix Team 2 - reference queries (supabase/queries.sql)
-- =============================================================================
-- Every query the booking module runs, written as raw SQL, in the same order
-- as libs/booking/src/lib/data-access/repositories/supabase-repairs.repository.ts.
--
-- In the app these run through supabase-js (PostgREST). Here you can run them
-- in Studio -> SQL editor to check them by hand.
--
-- auth.uid() only works for a signed-in API request. In the SQL editor the role
-- is "postgres", so auth.uid() is null and RLS is bypassed. That is expected.
-- To test as a real customer, use the app or PostgREST with a user JWT.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Q1. The table contract (what other teams may rely on)
-- ----------------------------------------------------------------------------
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'repairs'
order by ordinal_position;

-- ----------------------------------------------------------------------------
-- Q2. listByCustomer(userId) - My Repairs + Dashboard list
--     RLS repairs_select_own already limits this to the caller's own rows.
-- ----------------------------------------------------------------------------
select *
from public.repairs
where customer_id = auth.uid()
order by created_at desc;

-- ----------------------------------------------------------------------------
-- Q3. create(draft, userId) - New Booking form
--     The availability constraint and the check constraints run here.
--     A taken slot fails with: SQLSTATE 23P01 (exclusion_violation).
-- ----------------------------------------------------------------------------
insert into public.repairs (
  customer_id, service_id, technician_id,
  device_brand, device_model, location,
  booking_date, booking_time,
  issue_screen, issue_battery, issue_charging,
  issue_camera, issue_audio, issue_software
) values (
  auth.uid(), '<service uuid>', null,
  'Samsung', 'Galaxy A54', 'Main Branch - Downtown',
  current_date + 1, '10:00',
  true, false, false,
  false, false, false
)
returning *;

-- ----------------------------------------------------------------------------
-- Q4. cancel(repairId, userId) - only allowed while pending/in_progress.
--     A completed repair fails with SQLSTATE 42501 from the guard trigger.
-- ----------------------------------------------------------------------------
update public.repairs
set status = 'cancelled'
where id = '<repair uuid>' and customer_id = auth.uid()
returning *;

-- ----------------------------------------------------------------------------
-- Q5. reschedule(repairId, userId, date, time) - only a pending booking.
--     Overlap fails with 23P01, non-pending fails with 42501.
-- ----------------------------------------------------------------------------
update public.repairs
set booking_date = current_date + 2, booking_time = '14:00'
where id = '<repair uuid>' and customer_id = auth.uid()
returning *;

-- ----------------------------------------------------------------------------
-- Q6. takenSlots(location, date) - powers "free slots only" in the form.
--     SECURITY DEFINER so it can see other customers' busy hours without
--     exposing their rows; it returns times only.
-- ----------------------------------------------------------------------------
select *
from public.get_taken_slots('Main Branch - Downtown', current_date + 1);

-- Same call while rescheduling repair X (X's own hour is ignored):
-- select * from public.get_taken_slots('Main Branch - Downtown', current_date + 1, '<repair x uuid>');

-- ----------------------------------------------------------------------------
-- Q7. Pickers from other modules (read-only for Team 2)
-- ----------------------------------------------------------------------------
-- Team 3: services
select id, name, description, base_price
from public.services
where active is true
order by name;

-- Team 1: technicians (+ profile name)
select t.id, p.full_name, t.skills
from public.technicians t
join public.profiles p on p.id = t.profile_id
where t.active is true
order by p.full_name;

-- ----------------------------------------------------------------------------
-- Q8. Proof that the availability rule lives in the database
--     Run the two statements below TWICE each. The second run must fail with:
--     "conflicting key value violates exclusion constraint
--      repairs_no_double_booking" (SQLSTATE 23P01).
-- ----------------------------------------------------------------------------
-- insert into public.repairs (customer_id, service_id, device_brand, device_model, location, booking_date, booking_time, issue_screen)
-- values (auth.uid(), '<service uuid>', 'Test', 'A', 'Main Branch - Downtown', current_date + 3, '09:00', true);

-- Same hour, DIFFERENT location -> must PASS:
-- insert into public.repairs (customer_id, service_id, device_brand, device_model, location, booking_date, booking_time, issue_screen)
-- values (auth.uid(), '<service uuid>', 'Test', 'B', 'North Mall Branch', current_date + 3, '09:00', true);

-- ----------------------------------------------------------------------------
-- Q9. What the team 4 / team 3 views will read from us (kept for reference)
-- ----------------------------------------------------------------------------
select status, count(*) as total
from public.repairs
group by status
order by status;

select technician_id, count(*) as total,
       count(*) filter (where status = 'completed') as completed
from public.repairs
where technician_id is not null
group by technician_id;
