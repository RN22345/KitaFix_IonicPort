/**
 * Create/reuse the demo accounts for the hosted project.
 * Uses the service_role key in memory only (it is never printed or written).
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   $env:DEMO_PASSWORD='...'          # required, not stored in the repo
 *   node tools/supabase/create-demo-users.mjs <project-ref>
 */
const [, , ref] = process.argv;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const password = process.env.DEMO_PASSWORD;

if (!ref || !token || !password) {
  console.error('usage: node create-demo-users.mjs <project-ref>');
  console.error('env: SUPABASE_ACCESS_TOKEN, DEMO_PASSWORD');
  process.exit(2);
}

const keys = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json();

const service = keys.find((k) => k.name === 'service_role')?.api_key;
if (!service) {
  console.error('service_role key not found');
  process.exit(1);
}

const url = `https://${ref}.supabase.co`;
const users = [
  { email: 'customer@kitafix.test', full_name: 'Alex Santos' },
  { email: 'marcos.tech@kitafix.test', full_name: 'Marco Reyes' },
  { email: 'dina.tech@kitafix.test', full_name: 'Dina Villanueva' },
  { email: 'staff@kitafix.test', full_name: 'Sam Cruz' },
];

for (const user of users) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    }),
  });
  const body = await res.text();
  if (res.ok) {
    console.log(`CREATED ${user.email}`);
  } else if (res.status === 422 || body.includes('already been registered')) {
    console.log(`EXISTS  ${user.email}`);
  } else {
    console.log(`FAIL    ${user.email} [${res.status}] ${body.slice(0, 300)}`);
  }
}

console.log('\nNow set roles (SQL editor or apply-sql.mjs):');
console.log("  update public.profiles set role = 'technician' where full_name in ('Marco Reyes','Dina Villanueva');");
console.log("  update public.profiles set role = 'staff' where full_name = 'Sam Cruz';");
