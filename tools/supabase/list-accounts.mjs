/**
 * READ-ONLY: list every account on the hosted project with its role.
 * Shows email, name, role, active, technician row, created / last sign-in /
 * last profile change. No passwords, no personal details (address etc.).
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/list-accounts.mjs <project-ref> [--out accounts.json]
 *
 * The output contains real email addresses: do not commit or share it.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const ref = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : null;
const token = process.env.SUPABASE_ACCESS_TOKEN;

const QUERY = `
select u.email,
       p.full_name,
       coalesce(p.role::text, '(no profile)') as role,
       p.active,
       t.id is not null as technician_row,
       to_char(u.created_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as created,
       to_char(u.last_sign_in_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as last_sign_in,
       to_char(p.updated_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as profile_changed
from auth.users u
left join public.profiles p on p.id = u.id
left join public.technicians t on t.profile_id = u.id and t.active
order by case p.role when 'admin' then 0 when 'technician' then 1 else 2 end, u.email;`;

if (!ref || !token) {
  console.error('usage: node tools/supabase/list-accounts.mjs <project-ref> [--out file.json]   (env: SUPABASE_ACCESS_TOKEN)');
  process.exitCode = 2;
} else {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED [HTTP ${res.status}] ${text.slice(0, 800)}`);
    process.exitCode = 1;
  } else {
    const rows = JSON.parse(text);
    if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 2), 'utf8');
    const cols = ['email', 'full_name', 'role', 'active', 'technician_row', 'created', 'last_sign_in', 'profile_changed'];
    const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
    const line = (vals) => vals.map((v, i) => String(v ?? '').padEnd(width[i])).join('  ');
    console.log(line(cols));
    console.log(width.map((w) => '-'.repeat(w)).join('  '));
    for (const r of rows) console.log(line(cols.map((c) => r[c])));
    const count = (role) => rows.filter((r) => r.role === role).length;
    console.log(`\n${rows.length} accounts: ${count('admin')} admin, ${count('technician')} technician, ${count('customer')} customer`
      + (out ? `  (also written to ${out})` : ''));
  }
}
