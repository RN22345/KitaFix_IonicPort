/**
 * READ-ONLY: report what the hosted project already has, so migrations can be
 * matched to it. Runs SELECT queries only; it cannot change anything.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/inspect-hosted.mjs <project-ref> [--full] [--out file.json]
 *
 *   (no flag) names: migrations, tables, functions, columns, triggers, policies, buckets
 *   --full    also definitions: function bodies, trigger/policy/view/constraint/index
 *             SQL, column types and defaults, table/column/function grants, enums.
 *             Structure only - no table rows, no keys, no passwords.
 *   --out     write UTF-8 JSON to that file (PowerShell's ">" writes UTF-16).
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const ref = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
const full = args.includes('--full');
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : null;
const token = process.env.SUPABASE_ACCESS_TOKEN;

const SUMMARY = `
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

// Functions that belong to an extension (btree_gist etc.) are left out.
const FULL = `
select json_build_object(
  'migrations', (select coalesce(json_agg(v order by v), '[]') from (
      select version || ' ' || coalesce(name, '') as v from supabase_migrations.schema_migrations) m),
  'columns', (select coalesce(json_agg(json_build_object(
        'table', table_name, 'column', column_name, 'type', udt_name,
        'nullable', is_nullable, 'default', column_default) order by table_name, ordinal_position), '[]')
      from information_schema.columns where table_schema = 'public'),
  'functions', (select coalesce(json_agg(json_build_object(
        'name', p.proname, 'args', pg_get_function_identity_arguments(p.oid),
        'acl', p.proacl::text, 'def', pg_get_functiondef(p.oid)) order by p.proname), '[]')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  'triggers', (select coalesce(json_agg(json_build_object(
        'table', n.nspname || '.' || c.relname, 'name', t.tgname, 'enabled', t.tgenabled,
        'def', pg_get_triggerdef(t.oid)) order by n.nspname, c.relname, t.tgname), '[]')
      from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal and n.nspname in ('public', 'auth', 'storage')),
  'policies', (select coalesce(json_agg(json_build_object(
        'table', schemaname || '.' || tablename, 'name', policyname, 'permissive', permissive,
        'roles', roles::text, 'cmd', cmd, 'using', qual, 'check', with_check)
        order by schemaname, tablename, policyname), '[]')
      from pg_policies where schemaname in ('public', 'storage')),
  'rls', (select coalesce(json_agg(json_build_object('table', c.relname, 'enabled', c.relrowsecurity)
        order by c.relname), '[]')
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'),
  'views', (select coalesce(json_agg(json_build_object('name', c.relname,
        'options', c.reloptions::text, 'def', pg_get_viewdef(c.oid)) order by c.relname), '[]')
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'),
  'constraints', (select coalesce(json_agg(json_build_object('table', c.relname, 'name', k.conname,
        'def', pg_get_constraintdef(k.oid)) order by c.relname, k.conname), '[]')
      from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'),
  'indexes', (select coalesce(json_agg(json_build_object('table', tablename, 'name', indexname,
        'def', indexdef) order by tablename, indexname), '[]')
      from pg_indexes where schemaname = 'public'),
  'enums', (select coalesce(json_agg(json_build_object('type', t.typname,
        'values', (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
        order by t.typname), '[]')
      from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typtype = 'e'),
  'table_grants', (select coalesce(json_agg(json_build_object('table', table_name, 'grantee', grantee,
        'privilege', privilege_type) order by table_name, grantee, privilege_type), '[]')
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  'column_grants', (select coalesce(json_agg(json_build_object('table', table_name, 'column', column_name,
        'grantee', grantee, 'privilege', privilege_type) order by table_name, column_name, grantee), '[]')
      from information_schema.column_privileges
      where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT'),
  'buckets', (select coalesce(json_agg(json_build_object('id', id, 'public', public,
        'size_limit', file_size_limit, 'mime', allowed_mime_types)), '[]') from storage.buckets)
) as report;`;

if (!ref || !token) {
  console.error('usage: node inspect-hosted.mjs <project-ref> [--full] [--out file.json]   (env: SUPABASE_ACCESS_TOKEN)');
  process.exitCode = 2;
} else {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: full ? FULL : SUMMARY }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED [HTTP ${res.status}]`);
    console.error(text.slice(0, 1500));
    process.exitCode = 1;
  } else {
    let body = text;
    try {
      body = JSON.stringify(JSON.parse(text)[0].report, null, 2);
    } catch {
      /* print the raw response */
    }
    if (out) {
      fs.writeFileSync(out, body, 'utf8');
      console.log(`Wrote ${out} (${Math.round(body.length / 1024)} kB)`);
    } else {
      console.log(body);
    }
  }
}
