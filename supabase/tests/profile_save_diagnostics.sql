-- Read-only: run in Supabase SQL Editor as postgres.
-- Returns schema/access configuration only; no profile values or Auth records.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('id', 'first_name', 'last_name', 'full_name',
    'contact_no', 'address', 'birthday', 'gender', 'role', 'active')
order by column_name;

select column_name,
  has_column_privilege('authenticated', 'public.profiles', column_name, 'UPDATE') as authenticated_can_update
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('first_name', 'last_name', 'full_name', 'contact_no', 'address', 'birthday', 'gender')
order by column_name;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'profiles'
order by policyname;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid = 'public.profiles'::regclass;
