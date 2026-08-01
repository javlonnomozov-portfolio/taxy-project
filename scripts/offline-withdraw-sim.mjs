// "Oflayn holatda ham zakaz kelayabdi" regressiyasi.
//
// Haydovchi ishni tugatganda unga yuborilgan KUTILAYOTGAN taklif qaytarib
// olinmasdi: 120 soniya davomida dispatch oynasidagi joyni "band" qilib turardi
// va `/offers/pending` uni qaytarishda davom etardi — ilova fondan qaytganda
// "Oflayn" yozuvi bilan birga taklif kartasini ko'rsatardi.
//
// Ishga tushirish: `node scripts/offline-withdraw-sim.mjs`
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

async function main() {
  console.log(`\n=== "Oflayn holatda taklif" sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);

  const customer = await j(
    'POST', '/customers/upsert',
    { telegramId: String(Date.now()), phone: simPhone('+99890'), firstName: 'Mijoz' },
    { 'x-internal-key': KEY },
  );

  // IKKI haydovchi: birinchisi oflayn bo'ladi, ikkinchisi taklifni olishi kerak.
  const d1 = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Ketuvchi',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt' },
  });
  const d2 = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Qoluvchi',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Nexia' },
  });

  const bag1 = { offers: [], cancels: [] };
  const bag2 = { offers: [], cancels: [] };
  const s1 = io(API + '/driver', { auth: { token: d1.token }, transports: ['websocket'] });
  const s2 = io(API + '/driver', { auth: { token: d2.token }, transports: ['websocket'] });
  s1.on('order:offer', (o) => bag1.offers.push(o));
  s1.on('order:offer_cancelled', (o) => bag1.cancels.push(o));
  s2.on('order:offer', (o) => bag2.offers.push(o));
  s2.on('order:offer_cancelled', (o) => bag2.cancels.push(o));
  await Promise.all([
    new Promise((r) => s1.on('connect', r)),
    new Promise((r) => s2.on('connect', r)),
  ]);

  // Faqat 1-haydovchi onlayn — taklif unga borishi kerak.
  await emit(s1, 'driver:online', {});
  s1.emit('driver:location', pickup);
  await sleep(700);

  const order = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1500);
  check('1-haydovchiga taklif keldi', bag1.offers.some((o) => o.orderId === order.id));

  const pend1 = await j('GET', '/offers/pending', undefined, { authorization: 'Bearer ' + d1.token });
  check('/offers/pending taklifni qaytaradi', pend1.some((o) => o.orderId === order.id), JSON.stringify(pend1));

  // Haydovchi ISHNI TUGATADI.
  console.log('\n--- Haydovchi "Ishni tugatish" bosdi ---');
  bag1.cancels.length = 0;
  await emit(s1, 'driver:offline', {});
  await sleep(900);

  check(
    'TAKLIF QAYTARIB OLINDI (order:offer_cancelled)',
    bag1.cancels.some((c) => c.orderId === order.id),
    JSON.stringify(bag1.cancels),
  );

  const pend2 = await j('GET', '/offers/pending', undefined, { authorization: 'Bearer ' + d1.token });
  check(
    '/offers/pending endi BO\'SH (ilova oflaynda taklif ko\'rsatmaydi)',
    !pend2.some((o) => o.orderId === order.id),
    JSON.stringify(pend2),
  );

  // Slot bo'shadi — endi 2-haydovchi onlayn bo'lsa taklifni olishi kerak.
  console.log('\n--- Slot bo\'shadi: 2-haydovchi taklifni oladi ---');
  await emit(s2, 'driver:online', {});
  s2.emit('driver:location', pickup);
  await sleep(2500);
  check(
    'Zakaz to\'xtab qolmadi — 2-haydovchiga taklif ketdi',
    bag2.offers.some((o) => o.orderId === order.id),
    JSON.stringify(bag2.offers.map((o) => o.orderId)),
  );

  s1.close();
  s2.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
