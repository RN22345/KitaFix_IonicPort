/**
 * READ-ONLY: regenerate libs/shared-types/src/lib/database.generated.ts from the
 * hosted project (the frozen contract, rule R4). Run after applying migrations.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/gen-types.mjs <project-ref>
 */
import fs from 'node:fs';

const ref = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const target = 'libs/shared-types/src/lib/database.generated.ts';

if (!ref || !token) {
  console.error('usage: node tools/supabase/gen-types.mjs <project-ref>   (env: SUPABASE_ACCESS_TOKEN)');
  process.exitCode = 2;
} else {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED [HTTP ${res.status}] ${text.slice(0, 800)}`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(target, JSON.parse(text).types, 'utf8');
    console.log(`Wrote ${target}. Now run: npx ng build  (type errors = a contract change)`);
  }
}
