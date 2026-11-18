// API tests - run with `npm test`. They use a temporary copy of the data and
// a temporary PKI, so nothing in backend/data or backend/pki is touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kf-test-'));
process.env.DATA_DIR = path.join(tmp, 'data');
process.env.PKI_DIR = path.join(tmp, 'pki');
process.env.HTTPS = 'off';
fs.mkdirSync(process.env.DATA_DIR);
for (const f of ['produce.json', 'zones.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', f), path.join(process.env.DATA_DIR, f));
}

const { createApp } = require('../src/app');
const users = require('../src/services/users');
const { today } = require('../src/services/validators');

let server;
let base;
const call = async (method, url, body, cookie) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
};

const order = (extra = {}) => ({
  organisation: 'Machakos Girls High School',
  contactName: 'Jane Mutua',
  phone: '0712 345 678',
  email: '',
  produceId: 'TOM-G1-ATH',
  quantity: 10,
  zone: 'machakos-town',
  deliveryDate: today(),
  notes: '',
  consent: true,
  ...extra,
});

test.before(async () => {
  await users.setPassword('admin@test.ke', 'correct-horse-battery');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('catalog filters by category, price and stock', async () => {
  const all = await call('GET', '/api/produce');
  assert.equal(all.body.count, 22);
  const veg = await call('GET', '/api/produce?category=Vegetables&maxPrice=3000&inStock=true');
  assert.ok(veg.body.count > 0);
  assert.ok(veg.body.items.every((i) => i.category === 'Vegetables' && i.price <= 3000 && i.status !== 'sold-out'));
});

test('estimate = quantity x price + delivery fee, with MOQ warning', async () => {
  const ok = await call('POST', '/api/estimate', { produceId: 'TOM-G1-ATH', quantity: 10, zone: 'machakos-town' });
  assert.equal(ok.body.total, 10 * 2800 + 500);
  assert.equal(ok.body.belowMinimum, false);
  const low = await call('POST', '/api/estimate', { produceId: 'TOM-G1-ATH', quantity: 2, zone: 'machakos-town' });
  assert.equal(low.body.belowMinimum, true);
});

test('requisition rejects bad phone, past date, quantity below MOQ, sold out, no consent', async () => {
  const bad = await call('POST', '/api/requisitions', order({ phone: '12345', deliveryDate: '2020-01-01', quantity: 1, consent: false }));
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys(bad.body.fields).sort(), ['consent', 'deliveryDate', 'phone', 'quantity']);
  const sold = await call('POST', '/api/requisitions', order({ produceId: 'CAR-G1-KAN' }));
  assert.equal(sold.status, 422);
  assert.ok(sold.body.fields.produceId);
});

test('valid requisition returns a reference and a receipt whose signature verifies', async () => {
  const res = await call('POST', '/api/requisitions', order());
  assert.equal(res.status, 201);
  assert.match(res.body.ref, /^KF-\d{8}-[2-9A-Z]{5}$/);
  assert.equal(res.body.receipt.total, 28500);

  const pki = (await call('GET', '/api/pki/certificate')).body;
  assert.equal(pki.chainValid, true);
  const check = (text) =>
    crypto.verify('sha256', Buffer.from(text), pki.signing.publicKeyPem, Buffer.from(res.body.signature, 'base64'));
  assert.equal(check(res.body.canonical), true);
  assert.equal(check(res.body.canonical.replace('28500', '500')), false, 'a tampered receipt must fail');

  const again = await call('GET', `/api/requisitions/${res.body.ref}/receipt`);
  assert.equal(again.body.signature, res.body.signature);
  assert.equal(again.body.receipt.phone, undefined, 'receipt must not expose contact details');
});

test('grower and contact forms validate and save', async () => {
  const bad = await call('POST', '/api/growers', { contactName: 'A', phone: 'x', crops: [], consent: true });
  assert.equal(bad.status, 422);
  const ok = await call('POST', '/api/growers', {
    contactName: 'Peter Kioko', phone: '+254722000111', location: 'Mwala', farmSize: 2.5, crops: ['Mangoes'], consent: true,
  });
  assert.equal(ok.status, 201);
  const msg = await call('POST', '/api/contact', {
    name: 'Jane Mutua', email: 'jane@example.com', subject: 'Weekly supply', message: 'Can you supply kale every Monday?', consent: true,
  });
  assert.equal(msg.status, 201);
});

test('admin API needs a signed session; forged tokens are refused', async () => {
  assert.equal((await call('GET', '/api/admin/requisitions')).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: 'admin@test.ke', password: 'wrong' })).status, 401);

  const login = await call('POST', '/api/auth/login', { email: 'admin@test.ke', password: 'correct-horse-battery' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);

  const list = await call('GET', '/api/admin/requisitions', null, cookie);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 1);

  // Change the payload but keep the signature -> must be rejected.
  const [h, , s] = cookie.split('=')[1].split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'evil@x.ke', role: 'admin', exp: 9999999999 })).toString('base64url');
  assert.equal((await call('GET', '/api/admin/requisitions', null, `kf_session=${h}.${forged}.${s}`)).status, 401);

  const ref = list.body.items[0].ref;
  assert.equal((await call('PATCH', `/api/admin/requisitions/${ref}`, { status: 'confirmed' }, cookie)).body.status, 'confirmed');

  const listing = { id: 'OKR-G1-TAL', crop: 'Okra', variety: 'Pusa Sawani', category: 'Vegetables', grade: 1, unit: '20 kg crate',
    price: 1500, moq: 3, stock: 20, location: 'Tala', cooperative: 'Tala Root Crop Group', harvestDate: '2026-11-27', status: 'available' };
  assert.equal((await call('POST', '/api/admin/produce', listing, cookie)).status, 201);
  assert.equal((await call('POST', '/api/admin/produce', listing, cookie)).status, 409);
  assert.equal((await call('PUT', '/api/admin/produce/OKR-G1-TAL', { ...listing, price: 1600 }, cookie)).body.price, 1600);
  assert.equal((await call('DELETE', '/api/admin/produce/OKR-G1-TAL', null, cookie)).status, 204);
});

test('security headers are set and unknown API routes return JSON 404', async () => {
  const res = await call('GET', '/api/nope');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
