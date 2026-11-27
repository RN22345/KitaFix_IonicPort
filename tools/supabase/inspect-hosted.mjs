/**
 * READ-ONLY: report what the hosted project already has, so migrations can be
 * matched to it. Runs a single SELECT; it cannot change anything.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/inspect-hosted.mjs <project-ref> > hosted-report.json
 */
const [, , ref] = process.argv;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('usage: node inspect-hosted.mjs <project-ref>   (env: SUPABASE_ACCESS_TOKEN)');
  process.exitCode = 2;
} else {
  const query = `
select json_build_object(
  'migrations', (select coalesce(json_agg(v order by v), '[]') from (
      select version || ' ' || coalesce(name, '') as v from supabase_migrations.schema_migrations) m),
  'tables', (select coalesce(json_agg(c.relname order by c.relname), '[]')
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v')),
  'functions', (select coalesce(json_agg(json_build_object(
        'name', p.proname,
        'args', pg_get_function_identity_arguments(p.oid),
        'returns', pg_get_function_result(p.oid),
        'definer', p.prosecdef) order by p.proname), '[]')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'),
  'profiles_columns', (select coalesce(json_agg(column_name || ' ' || data_type order by ordinal_position), '[]')
      from information_schema.columns where table_schema = 'public' and table_name = 'profiles'),
  'repairs_columns', (select coalesce(json_agg(column_name order by ordinal_position), '[]')
      from information_schema.columns where table_schema = 'public' and table_name = 'repairs'),
  'triggers', (select coalesce(json_agg(c.relname || '.' || t.tgname order by 1), '[]')
      from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal and n.nspname in ('public', 'auth')),
  'policies', (select coalesce(json_agg(tablename || '.' || policyname order by 1), '[]')
      from pg_policies where schemaname in ('public', 'storage')),
  'buckets', (select coalesce(json_agg(id || case when public then ' (public)' else '' end), '[]') from storage.buckets)
) as report;`;

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED [HTTP ${res.status}]`);
    console.error(text.slice(0, 1500));
    process.exitCode = 1;
  } else {
    try {
      console.log(JSON.stringify(JSON.parse(text)[0].report, null, 2));
    } catch {
      console.log(text);
    }
  }
}
