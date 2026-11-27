/**
 * Dry run: execute .sql files on a Supabase project in ONE transaction that is
 * always rolled back. Nothing is kept, even when everything succeeds. Use it before
 * apply-sql.mjs to see whether a set of migrations runs against the live schema.
 *
 * Each file's own top-level `begin;` / `commit;` lines are removed so they cannot
 * end the outer transaction early (do-block `begin` lines have no semicolon and stay).
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node tools/supabase/dry-run-sql.mjs <project-ref> supabase/migrations/0030_*.sql [...]
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , ref, ...files] = process.argv;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || files.length === 0 || !token) {
  console.error('usage: node dry-run-sql.mjs <project-ref> <file.sql> [file2.sql ...]');
  console.error('env: SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

const txLine = /^\s*(begin|commit)\s*;\s*$/gim;
const body = files
  .map((file) => `-- ===== ${path.basename(file)}\n${fs.readFileSync(file, 'utf8').replace(txLine, '')}`)
  .join('\n');
const query = `begin;\n${body}\nrollback;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const text = await res.text();
// exitCode, not process.exit(): exiting while fetch is closing trips a libuv assert on Windows.
if (res.ok) {
  console.log(`DRY RUN OK (rolled back): ${files.map((f) => path.basename(f)).join(', ')}`);
} else {
  console.log(`DRY RUN FAILED [HTTP ${res.status}] - nothing was changed`);
  console.log(text.slice(0, 1500));
  process.exitCode = 1;
}
