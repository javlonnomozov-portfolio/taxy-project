// "Safarlar ro'yxatida hammasi bekor qilingan deb turibdi" regressiyasi.
//
// `ORDER BY completed_at DESC` ISHLAMAYDI: Postgres'da DESC uchun default
// NULLS FIRST, bekor qilingan zakazlarda `completed_at` BO'SH. Natijada barcha
// bekor qilinganlar ro'yxat BOSHINI egallab, yakunlangan safarlar pastga
// surilardi — haydovchi ro'yxatni ochib "hammasi bekor" deb ko'rardi.
//
// Ishga tushirish: `node scripts/trip-history-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = (m, p, b, h = {}) => jx(API, m, p, b, h);
const emit = (s, ev, data) => new Promise((res) => s.emit(ev, data, res));

const newCustomer = (n) =>
  j('POST', '/customers/upsert',
    { telegramId: String(Date.now() + n), phone: '+99894' + String(1000000 + n), firstName: 'M' + n },
    { 'x-internal-key': KEY });

async function main() {
  console.log(`\n=== Safarlar tarixi tartibi sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const d = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Tarix',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt' },
  });
  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  await emit(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  await sleep(700);

  // 1) AVVAL bir nechta zakazni mijoz bekor qiladi (completed_at = NULL).
  console.log('--- 3 ta bekor qilingan zakaz yaratamiz ---');
  for (let i = 0; i < 3; i++) {
    const c = await newCustomer(i);
    const o = await j('POST', '/orders', { customerId: c.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
    await sleep(1300);
    s.emit('driver:offer_response', { orderId: o.id, accept: true });
    await sleep(700);
    await j('POST', `/orders/${o.id}/cancel`, { reason: 'sim' }, { 'x-internal-key': KEY });
    await sleep(500);
  }

  // 2) SO'NGRA bitta safarni to'liq yakunlaymiz — u ENG YANGI bo'ladi.
  console.log('--- so\'ngra bitta safarni YAKUNLAYMIZ ---');
  const cLast = await newCustomer(99);
  const oLast = await j('POST', '/orders', { customerId: cLast.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1400);
  s.emit('driver:offer_response', { orderId: oLast.id, accept: true });
  await sleep(800);
  await emit(s, 'trip:arrived', { orderId: oLast.id });
  await emit(s, 'trip:start', { orderId: oLast.id });
  const done = await emit(s, 'trip:complete', { orderId: oLast.id, distanceM: 2500 });
  check('Safar yakunlandi', !!done && typeof done.finalPrice === 'number', JSON.stringify(done));
  await sleep(500);

  // 3) Tarix: eng yangi (yakunlangan) BIRINCHI bo'lishi kerak.
  const trips = await j('GET', '/drivers/me/trips', undefined, { authorization: 'Bearer ' + d.token });
  console.log('  ro\'yxat:', trips.map((t) => t.status).join(', '));

  check(
    'ENG YANGI yozuv — yakunlangan safar (bekor qilinganlar tepani egallamaydi)',
    trips[0] && trips[0].status === 'COMPLETED',
    trips[0] && trips[0].status,
  );
  check('Yakunlangan safar narxi bilan keldi', trips[0] && Number(trips[0].finalPrice) > 0, String(trips[0] && trips[0].finalPrice));

  // Tartib VAQT bo'yicha kamayishda bo'lishi kerak (bekor qilinganlar ham).
  const times = trips.map((t) => new Date(t.completedAt ?? t.createdAt).getTime());
  const sorted = times.every((v, i) => i === 0 || times[i - 1] >= v);
  check('Butun ro\'yxat VAQT bo\'yicha tartiblangan', sorted, JSON.stringify(times));

  s.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
