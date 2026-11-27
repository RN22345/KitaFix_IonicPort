-- MANUAL, only needed if public.profiles.address is absent in the live schema.
-- Registration 0092 supplies the other editable personal fields, but not address.
-- Review and run as postgres. No grants, policies, triggers or account data change.
begin;
alter table public.profiles add column if not exists address text;
commit;
