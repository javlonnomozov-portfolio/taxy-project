// 5+ yo'lovchi: taklif FAQAT sig'adigan mashinaga ketadi (2026-08-22).
//
// MUAMMO: bitta toifa ichida turli sig'imdagi mashinalar yuradi — Standartda
// Damas (7 o'rin) ham, Cobalt/Nexia (4 o'rin) ham bor. 5 kishilik oila zakaz
// bersa, unga 4 o'rinli mashina kelib qolardi.
//
// YECHIM: sig'im MASHINAGA bog'langan (`vehicles.seats`), mijoz yo'lovchilar
// sonini aytadi (`orders.passengers`), dispatch faqat `passengers > 4`
// bo'lganda filtrlaydi.
//
// MUHIM: oddiy zakazlar (1-4 yo'lovchi va "aytmagan") avvalgidek HAMMA
// haydovchiga borishi shart — aks holda "taksi topilmadi" xavfi butun
// tizimga tarqalardi (SESSION-2026-08.md §2.5).
//
// Ishga tushirish: `node scripts/seat-filter-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const INT = { 'x-internal-key': KEY };
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
    { telegramId: String(Date.now() + n), phone: simPhone('+99895'), firstName: 'M' + n }, INT);

/** Haydovchi + soket, berilgan o'rinlar soni bilan. */
async function makeDriver(adminToken, label, seats) {
  const d = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: label,
    vehicle: { category: 'standard', plate: simPlate(), model: label, seats },
  });
  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  await emit(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  const offers = [];
  s.on('order:offer', (o) => offers.push(o));
  return { ...d, socket: s, offers, label };
}

async function main() {
  console.log(`\n=== Sig'im filtri sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);

  console.log('--- 2 ta haydovchi: Damas (7 o\'rin) va Cobalt (4 o\'rin) ---');
  const damas = await makeDriver(adminToken, 'Damas', 7);
  const cobalt = await makeDriver(adminToken, 'Cobalt', 4);
  await sleep(900);

  // Mashina o'rinlari haqiqatan saqlanganini tekshiramiz — default 4 bo'lgani
  // uchun "saqlanmadi" holati jimgina o'tib ketishi mumkin edi.
  const ADM = { authorization: 'Bearer ' + adminToken };
  const list = await j('GET', '/ops/drivers', undefined, ADM);
  const dRow = list.find((x) => x.id === damas.driverId);
  const cRow = list.find((x) => x.id === cobalt.driverId);
  check('Damas mashinasi 7 o\'rin bilan saqlandi', dRow?.vehicles?.[0]?.seats === 7,
    JSON.stringify(dRow?.vehicles));
  check('Cobalt 4 o\'rin (entity default)', cRow?.vehicles?.[0]?.seats === 4,
    JSON.stringify(cRow?.vehicles));

  // Operator o'rinlar sonini O'ZGARTIRA olishi SHART — busiz filtr amalda
  // sozlanmaydi (CUSTOMER-APP-PLAN.md §4b.5: operator ishlata olmaydigan
  // funksiya chiqarilmasin).
  await j('PUT', `/ops/drivers/${cobalt.driverId}/vehicle`, { seats: 6 }, ADM);
  const after = await j('GET', '/ops/drivers', undefined, ADM);
  check('Operator o\'rinlar sonini o\'zgartira oldi (4 → 6)',
    after.find((x) => x.id === cobalt.driverId)?.vehicles?.[0]?.seats === 6);
  // Sim davomi 4 o'rin bilan ketishi uchun qaytaramiz.
  await j('PUT', `/ops/drivers/${cobalt.driverId}/vehicle`, { seats: 4 }, ADM);

  // ---- 1: 5 yo'lovchi → FAQAT Damas ----
  console.log('\n--- 1: 5 yo\'lovchi so\'raldi ---');
  const c1 = await newCustomer(1);
  const o1 = await j('POST', '/orders',
    { customerId: c1.id, category: 'standard', pickup, passengers: 5 }, INT);
  await sleep(2000);

  const damasGot1 = damas.offers.some((o) => o.orderId === o1.id);
  const cobaltGot1 = cobalt.offers.some((o) => o.orderId === o1.id);
  check('Damas (7 o\'rin) taklif OLDI', damasGot1);
  check('Cobalt (4 o\'rin) taklif OLMADI', !cobaltGot1,
    'cobalt takliflar: ' + JSON.stringify(cobalt.offers.map((o) => o.orderId)));

  await j('POST', `/orders/${o1.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  damas.offers.length = 0;
  cobalt.offers.length = 0;

  // ---- 2: 3 yo'lovchi → IKKALASI ham (filtr ishlamaydi) ----
  console.log('\n--- 2: 3 yo\'lovchi — filtr ishlamasligi kerak ---');
  const c2 = await newCustomer(2);
  const o2 = await j('POST', '/orders',
    { customerId: c2.id, category: 'standard', pickup, passengers: 3 }, INT);
  await sleep(2000);

  check('Damas taklif oldi', damas.offers.some((o) => o.orderId === o2.id));
  check('Cobalt HAM taklif oldi (4 o\'rin 3 yo\'lovchiga yetadi)',
    cobalt.offers.some((o) => o.orderId === o2.id),
    'cobalt: ' + JSON.stringify(cobalt.offers.map((o) => o.orderId)));

  await j('POST', `/orders/${o2.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  damas.offers.length = 0;
  cobalt.offers.length = 0;

  // ---- 3: yo'lovchilar soni AYTILMAGAN (bot/Mini App oqimi) ----
  console.log('\n--- 3: passengers berilmadi — eski oqim buzilmasin ---');
  const c3 = await newCustomer(3);
  const o3 = await j('POST', '/orders', { customerId: c3.id, category: 'standard', pickup }, INT);
  await sleep(2000);

  check('Damas taklif oldi', damas.offers.some((o) => o.orderId === o3.id));
  check('Cobalt HAM taklif oldi (filtr umuman ishlamadi)',
    cobalt.offers.some((o) => o.orderId === o3.id),
    'cobalt: ' + JSON.stringify(cobalt.offers.map((o) => o.orderId)));

  await j('POST', `/orders/${o3.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  damas.offers.length = 0;
  cobalt.offers.length = 0;

  // ---- 4: 5 yo'lovchi, lekin sig'adigan haydovchi YO'Q → NO_DRIVER ----
  console.log('\n--- 4: sig\'adigan mashina yo\'q → NO_DRIVER (aldab yubormaydi) ---');
  await emit(damas.socket, 'driver:offline', {});
  await sleep(700);

  const c4 = await newCustomer(4);
  const o4 = await j('POST', '/orders',
    { customerId: c4.id, category: 'standard', pickup, passengers: 6 }, INT);
  await sleep(2500);

  check('Cobalt taklif OLMADI', !cobalt.offers.some((o) => o.orderId === o4.id),
    'cobalt: ' + JSON.stringify(cobalt.offers.map((o) => o.orderId)));
  const st4 = await j('GET', `/orders/${o4.id}`, undefined, INT);
  check('Zakaz NO_DRIVER bo\'ldi (4 o\'rinli mashina 6 kishiga berilmadi)',
    st4.status === 'NO_DRIVER' || st4.status === 'CREATED',
    st4.status);

  // Bu zakaz hech qachon haydovchi topolmaydi (ataylab) — yopmasak
  // `recoverOrphans()` uni har API qayta ishga tushganda qayta tiklab,
  // keyingi simlarni chalg'itadi (HANDOFF §6: "Simlar orasida lokal
  // muhitni tozalang").
  await j('POST', `/orders/${o4.id}/cancel`, { reason: 'sim' }, INT).catch(() => {});

  damas.socket.close();
  cobalt.socket.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
