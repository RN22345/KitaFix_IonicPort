/**
 * Apply one or more .sql files to a Supabase project through the Management API.
 * No database password needed - only a personal access token.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/apply-sql.mjs <project-ref> supabase/migrations/0010_team1_identity.sql [...]
 *
 * The Management API records each call as a migration and runs it in a
 * transaction: if the SQL fails, nothing is applied.
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , ref, ...files] = process.argv;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || files.length === 0 || !token) {
  console.error('usage: node apply-sql.mjs <project-ref> <file.sql> [file2.sql ...]');
  console.error('env: SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

let failed = false;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`SKIP ${file} (not found)`);
    failed = true;
    continue;
  }

  const sql = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/migrations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, name }),
    },
  );

  const text = await res.text();
  if (res.ok) {
    console.log(`OK   ${name}`);
  } else {
    failed = true;
    console.log(`FAIL ${name} [HTTP ${res.status}]`);
    console.log(`     ${text.slice(0, 900)}`);
  }
}

process.exit(failed ? 1 : 0);
