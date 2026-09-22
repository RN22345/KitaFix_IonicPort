-- =============================================================================
-- KitaFix - demo data for a LOCAL Supabase (seed_demo_data.sql)
-- =============================================================================
-- Not a migration: run it by hand after the migrations and after signing up
-- the demo accounts. Nothing here is required in production.
--
-- HOW TO USE (see docs/Database_Setup.md for the full walkthrough):
--   1. `npx supabase start` and `npx supabase db reset`
--   2. Sign up in the app (or Studio -> Authentication) with:
--        customer@kitafix.test      (customer account)
--        marcos.tech@kitafix.test   (technician account)
--        dina.tech@kitafix.test     (technician account)
--   3. Promote the two technicians:
--        update public.profiles set role = 'technician'
--        where full_name in ('Marco Reyes', 'Dina Villanueva');
--   4. Paste this whole file into Studio -> SQL editor -> Run.
-- =============================================================================

insert into public.services (id, name, description, base_price, active) values
  ('c1000000-0000-4000-8000-000000000001', 'Screen Replacement', 'Full display and digitizer replacement.', 1499.00, true),
  ('c1000000-0000-4000-8000-000000000002', 'Battery Replacement', 'Genuine capacity battery swap.', 899.00, true),
  ('c1000000-0000-4000-8000-000000000003', 'Charging Port Repair', 'Port cleaning or replacement.', 650.00, true),
  ('c1000000-0000-4000-8000-000000000004', 'Water Damage Check', 'Full board inspection and cleaning.', 1200.00, true),
  ('c1000000-0000-4000-8000-000000000005', 'Software Reset', 'OS reinstall / factory reset with backup.', 500.00, true)
on conflict (id) do nothing;

do $$
declare
  v_customer uuid;
  v_service uuid;
begin
  -- The first customer profile becomes the demo customer.
  select id into v_customer
  from public.profiles
  where role = 'customer'
  order by created_at asc
  limit 1;

  if v_customer is null then
    raise notice 'No customer profile found. Sign up a customer account first, then run this file again.';
    return;
  end if;

  select id into v_service from public.services order by name limit 1;

  -- Turn the first two technician profiles into real technicians.
  insert into public.technicians (id, profile_id, skills, active)
  select 'b1000000-0000-4000-8000-000000000001', p.id,
         array['screen', 'battery', 'software'], true
  from public.profiles p
  where p.role = 'technician'
  order by p.created_at asc
  limit 1
  on conflict (profile_id) do nothing;

  insert into public.technicians (id, profile_id, skills, active)
  select 'b1000000-0000-4000-8000-000000000002', p.id,
         array['charging', 'water damage'], true
  from public.profiles p
  where p.role = 'technician'
  order by p.created_at asc
  offset 1 limit 1
  on conflict (profile_id) do nothing;

  -- Two sample bookings, dates relative to today so the demo never goes stale.
  insert into public.repairs (
    customer_id, service_id, device_brand, device_model, location,
    booking_date, booking_time, issue_screen, issue_battery
  ) values (
    v_customer, v_service, 'Samsung', 'Galaxy A54', 'Main Branch - Downtown',
    current_date + 1, '10:00', true, true
  );

  insert into public.repairs (
    customer_id, service_id, device_brand, device_model, location,
    booking_date, booking_time, issue_charging
  ) values (
    v_customer, v_service, 'Xiaomi', 'Redmi Note 13', 'North Mall Branch',
    current_date + 2, '14:00', true
  );

  raise notice 'Demo data ready for customer %', v_customer;
end
$$;
