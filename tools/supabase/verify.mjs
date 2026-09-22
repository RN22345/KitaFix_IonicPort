/**
 * End-to-end smoke test against a Supabase project using only the anon key
 * (exactly what the Angular app does): login, RLS read, create, double-book
 * rejection, cancel.
 *
 * Usage (PowerShell):
 *   node tools/supabase/verify.mjs <supabase-url> <anon-key>
 *   # optional: $env:DEMO_EMAIL / $env:DEMO_PASSWORD
 */
const [, , url, anonKey] = process.argv;
if (!url || !anonKey) {
  console.error('usage: node verify.mjs <supabase-url> <anon-key>');
  process.exit(2);
}

const email = process.env.DEMO_EMAIL ?? 'customer@kitafix.test';
const password = process.env.DEMO_PASSWORD;
if (!password) {
  console.error('env: DEMO_PASSWORD is required');
  process.exit(2);
}

const base = { apikey: anonKey, 'Content-Type': 'application/json' };

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: base,
  body: JSON.stringify({ email, password }),
});
const loginBody = await login.json();
if (!login.ok) {
  console.error('LOGIN FAILED', login.status, JSON.stringify(loginBody).slice(0, 300));
  process.exit(1);
}
const auth = {
  apikey: anonKey,
  Authorization: `Bearer ${loginBody.access_token}`,
  'Content-Type': 'application/json',
};
console.log(`LOGIN ok -> ${loginBody.user.email}`);

const rows = await (
  await fetch(`${url}/rest/v1/repairs?select=id,status,device_brand,booking_date,booking_time&order=created_at.desc`, { headers: auth })
).json();
console.log(`READ repairs -> ${Array.isArray(rows) ? rows.length : 'ERR'} row(s)`);

const services = await (
  await fetch(`${url}/rest/v1/services?select=id,name&limit=1`, { headers: auth })
).json();
if (!services?.[0]) {
  console.error('no services found - run seed_demo_data.sql first');
  process.exit(1);
}

const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const payload = {
  customer_id: loginBody.user.id,
  service_id: services[0].id,
  device_brand: 'SmokeTest',
  device_model: 'Verifier',
  location: 'Main Branch - Downtown',
  booking_date: date,
  booking_time: '15:00',
  issue_screen: true,
};

const created = await fetch(`${url}/rest/v1/repairs`, {
  method: 'POST',
  headers: { ...auth, Prefer: 'return=representation' },
  body: JSON.stringify(payload),
});
const createdBody = await created.json();
const newId = Array.isArray(createdBody) ? createdBody[0]?.id : createdBody?.id;
console.log(`CREATE -> HTTP ${created.status}${newId ? ` (id ${newId})` : ''}`);

const dup = await fetch(`${url}/rest/v1/repairs`, {
  method: 'POST',
  headers: { ...auth, Prefer: 'return=representation' },
  body: JSON.stringify(payload),
});
const dupBody = await dup.text();
const blocked = dupBody.includes('23P01') || dupBody.includes('repairs_no_double_booking');
console.log(`DOUBLE-BOOK -> HTTP ${dup.status} ${blocked ? '(23P01: PASS)' : dupBody.slice(0, 200)}`);

if (newId) {
  const cancel = await fetch(`${url}/rest/v1/repairs?id=eq.${newId}`, {
    method: 'PATCH',
    headers: { ...auth, Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const cancelBody = await cancel.text();
  console.log(`CANCEL -> HTTP ${cancel.status} ${cancelBody.includes('"cancelled"') ? '(PASS)' : cancelBody.slice(0, 200)}`);
  console.log('\nTip: delete the SmokeTest row with a service_role call or the Table editor.');
}
