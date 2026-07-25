// Sprint 3 simulyatsiyasi: komissiya/balans, ikki tomonlama baho, reyting tie-break, oldindan buyurtma.
// DISPATCH_WINDOW_SIZE=1 bilan ishga tushirilishi kerak (tie-break aniq ko'rinishi uchun).
import { io } from 'socket.io-client';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) (passed++, console.log(`  ✅ ${n}`)); else (failed++, console.log(`  ❌ ${n} ${e}`)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 3000, step = 50) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(step); } return false; }
const emitAck = (s, ev, d) => new Promise((res) => { let done = false; const t = setTimeout(() => { if (!done) (done = true, res({ __timeout: true })); }, 3000); s.emit(ev, d, (r) => { if (!done) (done = true, clearTimeout(t), res(r)); }); });
async function j(m, p, b, h = {}) { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${t}`); return t ? JSON.parse(t) : {}; }

async function mkDriver(suffix, name) {
  const p = '+99893' + suffix.padStart(7, '0');
  const otp = await j('POST', '/auth/driver/otp', { phone: p });
  const v = await j('POST', '/auth/driver/verify', { phone: p, code: otp.devCode });
  await j('POST', '/drivers/register', { firstName: name, vehicle: { category: 'standard', plate: 'S' + suffix, model: 'Nexia' } }, { authorization: 'Bearer ' + v.token });
  const s = io(API + '/driver', { auth: { token: v.token }, transports: ['websocket'] });
  s.offers = []; s.assigned = null;
  s.on('order:offer', (o) => s.offers.push(o));
  s.on('order:assigned', (o) => (s.assigned = o));
  await new Promise((r) => s.on('connect', r));
  await emitAck(s, 'driver:online', {});
  return { token: v.token, driverId: v.driverId, socket: s, name };
}

async function main() {
  console.log(`\n=== TTY Sprint 3 simulyatsiyasi (${API}) ===\n`);
  const admin = await j('POST', '/auth/admin/login', { login: 'admin', password: 'admin123' });
  const H = { authorization: 'Bearer ' + admin.token };
  const customer = await j('POST', '/customers/upsert', { telegramId: String(Date.now()), phone: '+998901234500', firstName: 'Sardor' }, { 'x-internal-key': KEY });

  const A = await mkDriver('1', 'Anvar');
  const B = await mkDriver('2', 'Botir');
  const ping = async (drv) => { drv.socket.emit('driver:location', { lat: pickup.lat, lng: pickup.lng }); };

  const cs = io(API + '/customer', { auth: { customerId: customer.id, internalKey: KEY }, transports: ['websocket'] });
  const statuses = [];
  cs.on('order:status', (x) => statuses.push(x));
  await new Promise((r) => cs.on('connect', r));

  // ---- Test 1: komissiya (foiz billing) ----
  console.log('--- Test 1: foiz billing → komissiya balansdan ---');
  await j('PUT', `/ops/drivers/${A.driverId}/billing`, { mode: 'percent', config: { percent: 10 } }, H);
  // Faqat A onlayn (B'ni vaqtincha offline)
  await emitAck(B.socket, 'driver:offline', {});
  await ping(A); await sleep(400);
  const o1 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await waitFor(() => A.socket.offers.some((o) => o.orderId === o1.id));
  A.socket.emit('driver:offer_response', { orderId: o1.id, accept: true });
  await waitFor(() => A.socket.assigned?.orderId === o1.id);
  await emitAck(A.socket, 'trip:arrived', { orderId: o1.id });
  await emitAck(A.socket, 'trip:start', { orderId: o1.id });
  const done = await emitAck(A.socket, 'trip:complete', { orderId: o1.id, distanceM: 5000 });
  const expectedCommission = Math.round(done.finalPrice * 0.1);
  check(`Komissiya = 10% × ${done.finalPrice} = ${expectedCommission}`, done.commission === expectedCommission, `(keldi: ${done.commission})`);
  const txns = await j('GET', `/ops/drivers/${A.driverId}/transactions`, null, H);
  const commTxn = txns.find((t) => t.type === 'commission');
  check('Komissiya transaksiyasi yozildi (manfiy)', commTxn && Number(commTxn.amount) === -expectedCommission, `(${commTxn?.amount})`);
  check('Balans manfiy bo\'ldi', Number(commTxn.balanceAfter) === -expectedCommission);

  // top-up
  await j('POST', `/ops/drivers/${A.driverId}/topup`, { amount: 50000 }, H);
  const txns2 = await j('GET', `/ops/drivers/${A.driverId}/transactions`, null, H);
  const topup = txns2.find((t) => t.type === 'topup');
  check('Ofisda to\'ldirish balansni oshirdi', topup && Number(topup.balanceAfter) === 50000 - expectedCommission, `(${topup?.balanceAfter})`);

  // ---- Test 2: ikki tomonlama baho ----
  console.log('\n--- Test 2: ikki tomonlama baholash ---');
  await j('POST', '/ratings/customer-to-driver', { orderId: o1.id, scores: { manners: 5, driving: 4, car_condition: 5, punctuality: 4 } }, { 'x-internal-key': KEY });
  await j('POST', '/ratings/driver-to-customer', { orderId: o1.id, scores: { manners: 5, payment_honesty: 5 } }, { authorization: 'Bearer ' + A.token });
  const drivers = await j('GET', '/ops/drivers', null, H);
  const aRow = drivers.find((d) => d.id === A.driverId);
  check('Haydovchi reytingi hisoblandi (4.5)', Number(aRow.ratingAvg) === 4.5, `(${aRow.ratingAvg})`);
  check('Haydovchi completion_rate > 0', Number(aRow.completionRate) > 0, `(${aRow.completionRate})`);

  // ---- Test 3: reyting tie-break (window=1) ----
  console.log('\n--- Test 3: reyting tie-break (teng masofa → yuqori reyting) ---');
  await emitAck(B.socket, 'driver:online', {});
  await ping(A); await ping(B); await sleep(500);
  A.socket.offers = []; B.socket.offers = [];
  const o2 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(800);
  const aGot = A.socket.offers.some((o) => o.orderId === o2.id);
  const bGot = B.socket.offers.some((o) => o.orderId === o2.id);
  check('Yuqori reytingli A taklif oldi', aGot, `(A=${aGot})`);
  check('Past reytingli B (window=1) taklif olmadi', !bGot, `(B=${bGot})`);
  // tozalash
  A.socket.emit('driver:offer_response', { orderId: o2.id, accept: false });
  await sleep(300);
  B.socket.emit('driver:offer_response', { orderId: o2.id, accept: true });
  await waitFor(() => B.socket.assigned?.orderId === o2.id);
  await emitAck(B.socket, 'trip:cancel', { orderId: o2.id });

  // ---- Test 4: oldindan buyurtma ----
  console.log('\n--- Test 4: oldindan buyurtma (operator tasdig\'i) ---');
  await ping(A); await ping(B); await sleep(300);
  A.socket.offers = []; B.socket.offers = [];
  const future = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const o3 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup, orderType: 'scheduled', scheduledAt: future }, { 'x-internal-key': KEY });
  await sleep(700);
  const noOfferYet = !A.socket.offers.some((o) => o.orderId === o3.id) && !B.socket.offers.some((o) => o.orderId === o3.id);
  check('Oldindan buyurtma darhol dispatch qilinmadi', noOfferYet);
  const sched = await j('GET', '/ops/scheduled', null, H);
  check('Oldindan buyurtma ops ro\'yxatida', sched.some((o) => o.id === o3.id));
  await j('POST', `/ops/orders/${o3.id}/confirm-scheduled`, {}, H);
  const dispatched = await waitFor(() => A.socket.offers.some((o) => o.orderId === o3.id) || B.socket.offers.some((o) => o.orderId === o3.id), 3000);
  check('Tasdiqlangach dispatch boshlandi (taklif keldi)', dispatched);

  console.log(`\n=== Natija: ${passed} ✅ / ${failed} ❌ ===\n`);
  A.socket.close(); B.socket.close(); cs.close();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('SIM XATO:', e.message); process.exit(1); });
