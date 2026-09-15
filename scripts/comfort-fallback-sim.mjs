// Comfort topilmadi -> Standartga o'tkazish taklifi (2026-09-14).
//
// MUAMMO: Comfort mashinalar kam. Mijoz Comfort tanlasa va u band/oflayn
// bo'lsa, zakaz NO_DRIVER'da qolib ketardi — holbuki bo'sh Standart mashina bor.
//
// YECHIM: NO_DRIVER + Comfort bo'lsa server `canSwitchToStandard: true`
// qaytaradi, mijoz (ilova/mini app/bot) yoki operator bitta tugma bilan
// zakazni Standart'ga o'tkazadi va qidiruv QAYTA boshlanadi. Holat va toifa
// bitta atomik so'rovda o'zgaradi.
//
// Ishga tushirish: `node scripts/comfort-fallback-sim.mjs`
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

async function call(method, path, headers = {}, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}

async function customerToken() {
  const telegramId = String(820000000 + Math.floor(Math.random() * 1e6));
  const customer = await j('POST', '/customers/upsert',
    { telegramId, phone: simPhone('+99893'), firstName: 'Comfortchi' }, INT);
  const started = await j('POST', '/auth/customer/start', { deviceId: 'sim-' + telegramId });
  const conf = await j('POST', '/auth/customer/confirm', { nonce: started.nonce, telegramId }, INT);
  const verified = await j('POST', '/auth/customer/verify', { nonce: started.nonce, code: conf.code });
  return { token: verified.token, customerId: customer.id, auth: { authorization: 'Bearer ' + verified.token } };
}

async function main() {
  console.log(`\n=== Comfort -> Standart sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ADM = { authorization: 'Bearer ' + adminToken };

  // Faqat STANDART mashina onlayn — Comfort zakaz uni topolmaydi.
  const std = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Nexia',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Nexia', seats: 4 },
  });
  const ds = io(API + '/driver', { auth: { token: std.token }, transports: ['websocket'] });
  await new Promise((r) => ds.on('connect', r));
  const offers = [];
  ds.on('order:offer', (o) => offers.push(o));
  await new Promise((r) => ds.emit('driver:online', {}, r));
  ds.emit('driver:location', pickup);
  await sleep(900);

  // ---- 1: mijoz ilovasi ----
  console.log('--- 1: mijoz ilovasidan ---');
  const me = await customerToken();
  const order = await j('POST', '/orders', { customerId: me.customerId, category: 'comfort', pickup }, INT);
  await sleep(2500);

  const t1 = await call('GET', `/customer/orders/${order.id}`, me.auth);
  check('Comfort topilmadi -> NO_DRIVER', t1.data?.orderStatus === 'NO_DRIVER', JSON.stringify(t1.data?.orderStatus));
  check('Server tugmani ruxsat etadi (canSwitchToStandard)', t1.data?.canSwitchToStandard === true && t1.data?.category === 'comfort',
    JSON.stringify({ c: t1.data?.category, s: t1.data?.canSwitchToStandard }));
  check('Standart haydovchiga Comfort taklifi BORMADI', !offers.some((o) => o.orderId === order.id));

  const other = await customerToken();
  const foreign = await call('POST', `/customer/orders/${order.id}/switch-standard`, other.auth);
  check('Begona mijoz o‘tkaza olmaydi', foreign.status === 404 || foreign.status === 403, String(foreign.status));

  const sw = await call('POST', `/customer/orders/${order.id}/switch-standard`, me.auth);
  check('O‘tkazildi', sw.status < 300 && sw.data?.category === 'standard', `${sw.status} ${JSON.stringify(sw.data)}`);
  await sleep(2000);

  check('Endi Standart haydovchi taklif oldi', offers.some((o) => o.orderId === order.id && o.category === 'standard'),
    JSON.stringify(offers.map((o) => [o.orderId === order.id, o.category])));
  const t2 = await call('GET', `/customer/orders/${order.id}`, me.auth);
  check('Toifa standard, tugma yo‘qoldi', t2.data?.category === 'standard' && t2.data?.canSwitchToStandard === false,
    JSON.stringify({ c: t2.data?.category, s: t2.data?.canSwitchToStandard, st: t2.data?.orderStatus }));

  const again = await call('POST', `/customer/orders/${order.id}/switch-standard`, me.auth);
  check('Qayta bosish rad etiladi (400)', again.status === 400, String(again.status));
  await j('POST', `/orders/${order.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);

  // ---- 1b: Comfort haydovchi onlayn, lekin JAVOB BERMAYDI ----
  //
  // Taklif muddatsiz turadi va zakaz hech qachon NO_DRIVER'ga tushmaydi — avval
  // tugma umuman chiqmasdi. Endi `COMFORT_SUGGEST_AFTER_SEC` dan keyin chiqadi,
  // Comfort qidiruvi esa DAVOM etadi. API qisqa chegara bilan ishga tushirilishi
  // kerak (masalan COMFORT_SUGGEST_AFTER_SEC=4), aks holda sim 60 s kutadi.
  console.log('\n--- 1b: Comfort haydovchi javob bermaydi ---');
  const cmf = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Malibu',
    vehicle: { category: 'comfort', plate: simPlate(), model: 'Malibu', seats: 4 },
  });
  const cs = io(API + '/driver', { auth: { token: cmf.token }, transports: ['websocket'] });
  await new Promise((r) => cs.on('connect', r));
  const cmfOffers = [];
  const cmfCancelled = [];
  cs.on('order:offer', (o) => cmfOffers.push(o));
  cs.on('order:offer_cancelled', (o) => cmfCancelled.push(o));
  await new Promise((r) => cs.emit('driver:online', {}, r));
  cs.emit('driver:location', pickup);
  await sleep(900);
  offers.length = 0;

  const waiter = await customerToken();
  const slow = await j('POST', '/orders', { customerId: waiter.customerId, category: 'comfort', pickup }, INT);
  await sleep(1500);
  const s0 = await call('GET', `/customer/orders/${slow.id}`, waiter.auth);
  check('Comfort haydovchi taklif oldi, qidiruv davom etmoqda',
    cmfOffers.some((o) => o.orderId === slow.id) && s0.data?.orderStatus === 'DISPATCHING',
    JSON.stringify(s0.data?.orderStatus));
  check('Darhol tugma YO‘Q, lekin taklif vaqti belgilangan',
    s0.data?.canSwitchToStandard === false && !!s0.data?.standardSuggestAt,
    JSON.stringify({ s: s0.data?.canSwitchToStandard, at: s0.data?.standardSuggestAt }));

  const waitMs = Math.max(0, new Date(s0.data?.standardSuggestAt).getTime() - Date.now()) + 800;
  await sleep(Math.min(waitMs, 70_000));
  const s1 = await call('GET', `/customer/orders/${slow.id}`, waiter.auth);
  check('Vaqt o‘tgach tugma chiqdi, Comfort qidiruvi DAVOM etmoqda',
    s1.data?.canSwitchToStandard === true && s1.data?.orderStatus === 'DISPATCHING',
    JSON.stringify({ s: s1.data?.canSwitchToStandard, st: s1.data?.orderStatus }));

  const sw2 = await call('POST', `/customer/orders/${slow.id}/switch-standard`, waiter.auth);
  check('Qidiruv davomida Standartga o‘tdi', sw2.status < 300 && sw2.data?.category === 'standard',
    `${sw2.status} ${JSON.stringify(sw2.data)}`);
  await sleep(1500);
  check('Comfort taklifi haydovchidan qaytarib olindi', cmfCancelled.some((o) => o.orderId === slow.id));
  check('Standart haydovchi yangi taklif oldi', offers.some((o) => o.orderId === slow.id && o.category === 'standard'),
    JSON.stringify(offers.map((o) => [o.orderId === slow.id, o.category])));

  await j('POST', `/orders/${slow.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  // Keyingi bo'limlar "Comfort topilmadi" holatini kutadi — haydovchini
  // darhol oflayn qilamiz (soket yopilsa 2 daqiqa onlayn qolardi).
  cs.emit('driver:offline', {});
  await sleep(600);
  cs.close();

  // ---- 2: bot (ichki yo'l) ----
  console.log('\n--- 2: bot orqali ---');
  const botOrder = await j('POST', '/orders', { customerId: other.customerId, category: 'comfort', pickup }, INT);
  await sleep(2500);
  const noKey = await call('POST', `/orders/${botOrder.id}/switch-standard`, {});
  check('Ichki kalitsiz bo‘lmaydi', noKey.status === 401 || noKey.status === 403, String(noKey.status));
  const viaBot = await call('POST', `/orders/${botOrder.id}/switch-standard`, INT);
  check('Bot yo‘li o‘tkazdi', viaBot.status < 300 && viaBot.data?.category === 'standard', `${viaBot.status} ${JSON.stringify(viaBot.data)}`);
  await j('POST', `/orders/${botOrder.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);

  // ---- 3: operator ----
  console.log('\n--- 3: operator panelidan ---');
  const third = await customerToken();
  const opsOrder = await j('POST', '/orders', { customerId: third.customerId, category: 'comfort', pickup }, INT);
  await sleep(2500);
  const stdOrder = await customerToken();
  const plain = await j('POST', '/orders', { customerId: stdOrder.customerId, category: 'standard', pickup }, INT);
  await sleep(1500);
  const wrong = await call('POST', `/ops/orders/${plain.id}/switch-standard`, ADM);
  check('Standart zakazni o‘tkazib bo‘lmaydi (400)', wrong.status === 400, String(wrong.status));
  const viaOps = await call('POST', `/ops/orders/${opsOrder.id}/switch-standard`, ADM);
  check('Operator o‘tkazdi', viaOps.status < 300 && viaOps.data?.category === 'standard', `${viaOps.status} ${JSON.stringify(viaOps.data)}`);
  const asCustomer = await call('POST', `/ops/orders/${opsOrder.id}/switch-standard`, third.auth);
  check('Mijoz tokeni panel yo‘liga kira olmaydi (403)', asCustomer.status === 403, String(asCustomer.status));

  for (const id of [opsOrder.id, plain.id]) await j('POST', `/orders/${id}/cancel`, { reason: 'sim' }, INT).catch(() => {});
  await sleep(600);
  ds.close();

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SIM XATOSI:', e); process.exit(1); });
