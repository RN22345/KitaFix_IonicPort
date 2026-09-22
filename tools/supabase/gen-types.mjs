/**
 * Fetch generated TypeScript types from a Supabase project (Management API)
 * and write them to the shared contract file. No database password needed.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/gen-types.mjs <project-ref> libs/shared-types/src/lib/database.generated.ts
 */
import fs from 'node:fs';

const [, , ref, out] = process.argv;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || !out || !token) {
  console.error('usage: node gen-types.mjs <project-ref> <out-file.ts>');
  console.error('env: SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!res.ok) {
  console.error('types request failed', res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}

const data = await res.json();
const types = typeof data === 'string' ? data : data.types;
if (!types) {
  console.error('no types in response', Object.keys(data));
  process.exit(1);
}

fs.writeFileSync(out, types, 'utf8');
console.log(`wrote ${out} (${types.length} chars)`);
