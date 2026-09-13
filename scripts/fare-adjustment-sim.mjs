// Operator buyurtma narxini tuzatadi (2026-09-13).
//
// MUAMMO: hayotda kelishuv taksometrdan chetga chiqadi — mijozda katta yuk
// bor, kutish uzoq bo'ldi, mashina kirmaydigan ko'chaga borildi. Avval bular
// telefon orqali hal bo'lib, pul TIZIMDAN TASHQARIDA olinardi: hisobotda ham,
// komissiyada ham ko'rinmasdi.
//
// YECHIM: `orders.fare_adjustment` + sabab. Operator faol zakazga summa
// qo'shadi, haydovchi uni ekranda ko'radi, yakuniy narxga ALOHIDA qator bo'lib
// kiradi (koeffitsientlarga ko'paytirilmaydi).
//
// Sim tekshiradi: validatsiya (sabab majburiy), haydovchiga yetishi (soket +
// `/trips/active`), yakuniy narx va yakunlangan zakazni o'zgartirib bo'lmasligi.
//
// Ishga tushirish: `node scripts/fare-adjustment-sim.mjs`
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
// trip:* ack qaytaradi; muddat — ack'siz hodisa simni abadiy qotirmasin.
const emit = (s, ev, data) =>
  new Promise((res) => {
    const to = setTimeout(() => res(undefined), 5000);
    s.emit(ev, data, (r) => { clearTimeout(to); res(r); });
  });

/** Holat kodini ham ko'rish uchun — `jx` xato holatda nima qilishiga tayanmaymiz. */
async function raw(method, path, body, headers) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  console.log(`\n=== Narx tuzatish sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ADM = { authorization: 'Bearer ' + adminToken };

  // Tanib olinadigan tarif: 10 km -> 5000 + 10*1000 = 15 000.
  const tariffs = await j('GET', '/ops/tariffs', undefined, ADM);
  const before = tariffs.find((t) => t.category === 'standard');
  const put = (body) => j('PUT', '/ops/tariffs/standard', body, ADM);
  await put({ baseFare: 5000, perKm: 1000, waitingPerMin: 0, freeWaitMin: 99, nightMultiplier: 1, surgeMultiplier: 1 });

  const d = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Nexia',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Nexia', seats: 4 },
  });
  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  await emit(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  const offers = [];
  const announcements = [];
  s.on('order:offer', (o) => offers.push(o));
  s.on('announcement', (a) => announcements.push(a));
  await sleep(900);

  const c = await j('POST', '/customers/upsert',
    { telegramId: String(Date.now()), phone: simPhone('+99895'), firstName: 'Yukli' }, INT);
  const o = await j('POST', '/orders', { customerId: c.id, category: 'standard', pickup }, INT);
  await sleep(2000);
  check('Haydovchi taklif oldi', offers.some((x) => x.orderId === o.id));

  s.emit('driver:offer_response', { orderId: o.id, accept: true }); // ack qaytarmaydi
  await sleep(900);
  await emit(s, 'trip:arrived', { orderId: o.id });
  await sleep(400);

  // ---- 1: validatsiya ----
  console.log('\n--- 1: validatsiya ---');
  const noReason = await raw('POST', `/ops/orders/${o.id}/fare`, { amount: 5000, reason: 'ab' }, ADM);
  check('Sababsiz (juda qisqa) → 400', noReason.status === 400, String(noReason.status));
  const huge = await raw('POST', `/ops/orders/${o.id}/fare`, { amount: 50_000_000, reason: 'katta yuk' }, ADM);
  check('Aql bovar qilmas summa → 400', huge.status === 400, String(huge.status));
  const noAuth = await raw('POST', `/ops/orders/${o.id}/fare`, { amount: 5000, reason: 'katta yuk' }, {});
  check('Tokensiz → 401', noAuth.status === 401, String(noAuth.status));

  // ---- 2: yaroqli tuzatish safar davomida ----
  console.log('\n--- 2: operator +5 000 qo\'shadi ---');
  const ok = await raw('POST', `/ops/orders/${o.id}/fare`, { amount: 5000, reason: 'katta yuk' }, ADM);
  check('Qabul qilindi (2xx)', ok.status >= 200 && ok.status < 300, `${ok.status} ${JSON.stringify(ok.body)?.slice(0, 120)}`);
  check('Javobda summa va sabab', Number(ok.body?.fareAdjustment) === 5000 && ok.body?.fareAdjustmentReason === 'katta yuk');
  await sleep(600);

  check('Haydovchiga soket xabari keldi', announcements.some((a) => a.orderId === o.id),
    JSON.stringify(announcements));
  const active = await j('GET', '/trips/active', undefined, { authorization: 'Bearer ' + d.token });
  const trip = active?.trip ?? active;
  check('/trips/active qo\'shimchani qaytaradi (ilova fondan qaytganda ham ko\'rsin)',
    Number(trip?.fareAdjustment) === 5000 && trip?.fareAdjustmentReason === 'katta yuk',
    JSON.stringify(trip)?.slice(0, 200));

  // ---- 3: yakuniy narx ----
  console.log('\n--- 3: safar yakuni ---');
  await emit(s, 'trip:start', { orderId: o.id });
  await sleep(400);
  await emit(s, 'trip:complete', { orderId: o.id, distanceM: 10000 });
  await sleep(1200);

  const done = await j('GET', `/orders/${o.id}`, undefined, INT);
  check('Zakaz yakunlandi', done?.status === 'COMPLETED', String(done?.status));
  check('Yakuniy narx = taksometr 15 000 + qo\'shimcha 5 000 = 20 000',
    Number(done?.finalPrice) === 20000, `haqiqiy: ${done?.finalPrice}`);

  // ---- 4: yakunlangandan keyin o'zgartirib bo'lmaydi ----
  console.log('\n--- 4: yakunlangan zakaz ---');
  const late = await raw('POST', `/ops/orders/${o.id}/fare`, { amount: 9000, reason: 'kech qoldi' }, ADM);
  check('Yakunlangan zakaz narxi o\'zgarmaydi → 400', late.status === 400, String(late.status));
  const still = await j('GET', `/orders/${o.id}`, undefined, INT);
  check('Narx avvalgidek 20 000', Number(still?.finalPrice) === 20000, String(still?.finalPrice));

  // Qaytaramiz.
  await put({
    baseFare: before.baseFare, perKm: before.perKm, waitingPerMin: before.waitingPerMin,
    freeWaitMin: before.freeWaitMin, nightMultiplier: before.nightMultiplier,
    surgeMultiplier: before.surgeMultiplier ?? 1,
  });
  s.close();

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('SIM XATOSI:', e);
  process.exit(1);
});
