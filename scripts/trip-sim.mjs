// Sprint 2 simulyatsiyasi: to'liq safar lifecycle + taksometr + no-show + bekor + ops.
// Bitta haydovchi + bitta mijoz ketma-ket buyurtmalarda ishtirok etadi.
import { io } from 'socket.io-client';
import { adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0,
  failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) (passed++, console.log(`  ✅ ${name}`));
  else (failed++, console.log(`  ❌ ${name} ${extra}`));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// `await fn()` — predikat async bo'lishi mumkin (Promise doim truthy bo'lib qolmasin).
async function waitFor(fn, ms = 3000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}
const emitAck = (s, ev, data) =>
  new Promise((res) => {
    let done = false;
    const t = setTimeout(() => { if (!done) (done = true, res({ __timeout: true })); }, 3000);
    s.emit(ev, data, (r) => { if (!done) (done = true, clearTimeout(t), res(r)); });
  });

async function j(method, path, body, headers = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  console.log(`\n=== TTY Sprint 2 simulyatsiyasi (${API}) ===\n`);

  // Mijoz + haydovchi
  const customer = await j('POST', '/customers/upsert', { telegramId: String(Date.now()), phone: '+998901112233', firstName: 'Ali' }, { 'x-internal-key': KEY });
  const phone = '+998911234567';
  const adminToken = await adminLogin(API);
  const v = await createDriver(API, adminToken, {
    phone,
    firstName: 'Vali',
    vehicle: { category: 'standard', plate: '01X777', make: 'Chevrolet', model: 'Nexia', color: 'oq' },
  });

  // Socketlar
  const d = io(API + '/driver', { auth: { token: v.token }, transports: ['websocket'] });
  d.offers = []; d.assigned = null; d.cancels = [];
  d.on('order:offer', (o) => d.offers.push(o));
  d.on('order:assigned', (o) => (d.assigned = o));
  d.on('order:offer_cancelled', (o) => d.cancels.push(o));
  await new Promise((r) => d.on('connect', r));
  await emitAck(d, 'driver:online', {});

  const cs = io(API + '/customer', { auth: { customerId: customer.id, internalKey: KEY }, transports: ['websocket'] });
  const statuses = [];
  cs.on('order:status', (x) => statuses.push(x));
  await new Promise((r) => cs.on('connect', r));

  const ping = async () => { d.emit('driver:location', { lat: pickup.lat, lng: pickup.lng }); await sleep(300); };
  const statusesFor = (id) => statuses.filter((s) => s.orderId === id).map((s) => s.status);
  async function createAndAccept(category = 'standard') {
    await ping();
    const order = await j('POST', '/orders', { customerId: customer.id, category, pickup }, { 'x-internal-key': KEY });
    await waitFor(() => d.offers.some((o) => o.orderId === order.id));
    d.emit('driver:offer_response', { orderId: order.id, accept: true });
    await waitFor(() => d.assigned?.orderId === order.id);
    d.assigned = null;
    return order;
  }

  // --- Test 1: to'liq safar + taksometr ---
  console.log('--- Test 1: to\'liq safar (confirm→arrived→start→complete) + narx ---');
  const o1 = await createAndAccept();
  await emitAck(d, 'trip:confirm', { orderId: o1.id });
  check('CONFIRMED status mijozga bordi', await waitFor(() => statusesFor(o1.id).includes('CONFIRMED')));
  await emitAck(d, 'trip:arrived', { orderId: o1.id });
  check('ARRIVED status', await waitFor(() => statusesFor(o1.id).includes('ARRIVED')));
  await emitAck(d, 'trip:start', { orderId: o1.id });
  check('IN_PROGRESS status', await waitFor(() => statusesFor(o1.id).includes('IN_PROGRESS')));
  await emitAck(d, 'trip:track_sync', { orderId: o1.id, points: [{ lat: 41.311, lng: 69.24, at: new Date().toISOString() }] });
  const done = await emitAck(d, 'trip:complete', { orderId: o1.id, distanceM: 5000 });
  check('COMPLETED status', await waitFor(() => statusesFor(o1.id).includes('COMPLETED')));
  const comp = statuses.find((s) => s.orderId === o1.id && s.status === 'COMPLETED');
  const b = comp?.breakdown;
  check('Bazaviy narx 4000', b?.base === 4000, `(base=${b?.base})`);
  check('Masofa narxi = 2000×5km = 10000', b?.distance === 10000, `(distance=${b?.distance})`);
  check('Yakuniy narx = subtotal×tungi×surge (izchil)', b && done.finalPrice === Math.round(b.subtotal * b.nightMultiplier * b.surgeMultiplier), `(final=${done.finalPrice})`);
  console.log(`     → yakuniy narx: ${done.finalPrice} so'm (tungi×${b?.nightMultiplier}, surge×${b?.surgeMultiplier})`);

  // --- Test 2: mijoz no-show ---
  console.log('\n--- Test 2: mijoz kelmadi (no-show) ---');
  const o2 = await createAndAccept();
  await emitAck(d, 'trip:arrived', { orderId: o2.id });
  const ns = await emitAck(d, 'trip:no_show', { orderId: o2.id });
  check('CUSTOMER_NO_SHOW status', await waitFor(() => statusesFor(o2.id).includes('CUSTOMER_NO_SHOW')));
  check('No-show javobida kutish haqi maydoni bor', ns && typeof ns.waitingFee === 'number');

  // --- Test 3: jarimasiz bekor (dispatch paytida) ---
  console.log('\n--- Test 3: jarimasiz bekor (haydovchi biriktirilmasdan) ---');
  await ping();
  const o3 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await waitFor(() => d.offers.some((o) => o.orderId === o3.id));
  const c3 = await j('POST', `/orders/${o3.id}/cancel`, { reason: 'fikrim o\'zgardi' }, { 'x-internal-key': KEY });
  check('Bekor jarimasiz (penalized=false)', c3.penalized === false, `(penalized=${c3.penalized})`);

  // --- Test 4: jarimali bekor (qabuldan keyin) ---
  console.log('\n--- Test 4: jarimali bekor (qabul qilingandan keyin) ---');
  const o4 = await createAndAccept();
  const c4 = await j('POST', `/orders/${o4.id}/cancel`, { reason: 'kerak emas' }, { 'x-internal-key': KEY });
  check('Bekor jarimali (penalized=true)', c4.penalized === true, `(penalized=${c4.penalized})`);

  // --- Test 5: ops qo'lda biriktirish (NO_DRIVER cargo) ---
  console.log('\n--- Test 5: operator qo\'lda biriktirish (NO_DRIVER) ---');
  const admin = await j('POST', '/auth/admin/login', { login: 'admin', password: 'admin123' }).catch((e) => { console.log('   (admin login xato:', e.message, ')'); return null; });
  if (admin) {
    const H = { authorization: 'Bearer ' + admin.token };
    await ping();
    const o5 = await j('POST', '/orders', { customerId: customer.id, category: 'cargo', pickup }, { 'x-internal-key': KEY });
    // MUHIM: NO_DRIVER mijozga DARHOL yuborilmaydi — operator (dispatcher) hal qiladi
    // (qarang DispatchService.onNoDriver). Shuning uchun mijoz socketini emas,
    // backend holatini tekshiramiz. Avval bu test mijoz statusini kutardi va
    // dispatcher nazorati qo'shilgandan beri (08721a9) doim yiqilardi.
    check(
      'Cargo buyurtma backendda NO_DRIVER bo\'ldi',
      await waitFor(async () => (await j('GET', `/orders/${o5.id}`, null, { 'x-internal-key': KEY })).status === 'NO_DRIVER', 4000),
    );
    check(
      'Mijozga avto NO_DRIVER YUBORILMADI (dispatcher hal qiladi)',
      !statusesFor(o5.id).includes('NO_DRIVER'),
    );
    const assigned = await j('POST', `/ops/orders/${o5.id}/assign`, { driverId: v.driverId }, H);
    check('Operator haydovchiga biriktirdi (ACCEPTED)', assigned.status === 'ACCEPTED', `(status=${assigned.status})`);
    // tozalash
    await emitAck(d, 'trip:cancel', { orderId: o5.id });

    // ops settings surge
    const s1 = await j('GET', '/ops/settings', null, H);
    const s2 = await j('PUT', '/ops/settings', { surgeActive: true, surgeMultiplier: 1.5 }, H);
    check('Surge sozlamasi yangilandi', s2.surgeActive === true && s2.surgeMultiplier === 1.5);
    await j('PUT', '/ops/settings', { surgeActive: false }, H); // qaytarish
    void s1;
  }

  console.log(`\n=== Natija: ${passed} ✅ / ${failed} ❌ ===\n`);
  d.close(); cs.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SIM XATO:', e.message); process.exit(1); });
