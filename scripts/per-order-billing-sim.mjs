// "Har zakaz uchun to'lov" (per_order) billing rejimi.
//
// Haydovchidan safar yakunlanganda QAT'IY summa yechiladi (safar narxiga bog'liq
// emas). Summa admin panelidan sozlanadi; haydovchi darajasida ustidan yozish
// mumkin. Balans MANFIYGA o'tishi kerak — aks holda qarzdor haydovchi safarni
// yakunlay olmay qolardi va mijoz ham osilib qolardi.
//
// Ishga tushirish: `node scripts/per-order-billing-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const pickup = { lat: 41.311, lng: 69.24 };
const FEE = 1500;

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = (m, p, b, h = {}) => jx(API, m, p, b, h);
const emit = (s, ev, data) => new Promise((res) => s.emit(ev, data, res));

/** Bitta to'liq safar: taklif → qabul → yetib keldim → boshladim → yakunladim. */
async function runTrip(s, customerId) {
  const order = await j('POST', '/orders', { customerId, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1400);
  s.emit('driver:offer_response', { orderId: order.id, accept: true });
  await sleep(900);
  await emit(s, 'trip:arrived', { orderId: order.id });
  await emit(s, 'trip:start', { orderId: order.id });
  const done = await emit(s, 'trip:complete', { orderId: order.id, distanceM: 3000 });
  return done;
}

async function main() {
  console.log(`\n=== "Har zakaz uchun to'lov" sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const auth = { authorization: 'Bearer ' + adminToken };

  // Admin panelidan summani sozlaymiz.
  await j('PUT', '/ops/settings', { perOrderFee: FEE }, auth);
  const cfg = await j('GET', '/ops/settings', undefined, auth);
  check('Admin paneldan summa sozlandi', Number(cfg.perOrderFee) === FEE, JSON.stringify(cfg));

  const customer = await j(
    'POST', '/customers/upsert',
    { telegramId: String(Date.now()), phone: simPhone(), firstName: 'Mijoz' },
    { 'x-internal-key': KEY },
  );

  const d = await createDriver(API, adminToken, {
    phone: simPhone(),
    firstName: 'Bekzod',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt' },
  });
  // BILLING REJIMI ATAYLAB O'RNATILMAYDI — yangi haydovchi STANDART holatda
  // ham pul to'lashi kerak.
  //
  // Nega bu tekshiruv bor: bu sim avval shu yerda `mode: 'per_order'` ni
  // O'ZI o'rnatardi va shuning uchun doim o'tardi. Prod'da esa haydovchi
  // entity default'i (`subscription`) bilan yaratilardi va undan HECH NARSA
  // yechilmasdi — xato ham chiqmasdi, shunchaki pul kelmasdi.
  const created = await j('GET', '/ops/drivers', null, auth);
  const me = created.find((x) => x.id === d.driverId);
  check(
    'Yangi haydovchi standart holatda per_order rejimida',
    me && me.billingMode === 'per_order',
    String(me && me.billingMode),
  );

  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((res) => s.on('connect', res));
  await emit(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  await sleep(700);

  console.log('--- 1-safar (balans 0 dan boshlanadi) ---');
  const t1 = await runTrip(s, customer.id);
  check('Safar yakunlandi', !!t1 && typeof t1.finalPrice === 'number', JSON.stringify(t1));
  check('Yechilgan summa aynan sozlangan qiymat', t1.commission === FEE, String(t1 && t1.commission));

  const b1 = await j('GET', `/ops/drivers/${d.driverId}/transactions`, undefined, auth);
  const last = b1[0];
  check('Tranzaksiya yozildi', !!last && Number(last.amount) === -FEE, JSON.stringify(last));
  check('BALANS MANFIYGA O‘TDI', Number(last.balanceAfter) === -FEE, String(last && last.balanceAfter));

  console.log('\n--- 2-safar (allaqachon qarzda) ---');
  const t2 = await runTrip(s, customer.id);
  check('Qarzdor haydovchi safarni YAKUNLAY OLDI', !!t2 && typeof t2.finalPrice === 'number', JSON.stringify(t2));
  const b2 = await j('GET', `/ops/drivers/${d.driverId}/transactions`, undefined, auth);
  check('Qarz chuqurlashdi (2 barobar)', Number(b2[0].balanceAfter) === -2 * FEE, String(b2[0].balanceAfter));

  console.log('\n--- Summa safar narxiga bog‘liq emas ---');
  check('1- va 2-safar to‘lovi bir xil', t1.commission === t2.commission);

  console.log('\n--- Ofisda to‘ldirish qarzni yopadi ---');
  await j('POST', `/ops/drivers/${d.driverId}/topup`, { amount: 5000 }, auth);
  const b3 = await j('GET', `/ops/drivers/${d.driverId}/transactions`, undefined, auth);
  check('To‘ldirishdan keyin balans musbat', Number(b3[0].balanceAfter) === 5000 - 2 * FEE, String(b3[0].balanceAfter));

  s.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
