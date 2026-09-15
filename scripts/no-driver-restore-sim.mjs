// "Taksi topilmadi" zakaz qayta ochilganda yo'qolmasin (2026-09-15).
//
// MUAMMO: mijoz Standart zakaz berdi, yagona haydovchi "Ishni tugatish"ni bosdi
// va zakaz NO_DRIVER'ga tushdi. Mijoz mini app'ni qayta ochganda server "faol
// zakaz yo'q" dedi — bo'sh buyurtma ekrani chiqdi ("zakaz bekor bo'ldi").
// Haydovchi qayta onlayn bo'lgach esa o'sha zakaz qayta ko'tarilib qabul
// qilindi: mijoz bexabar, haydovchi yo'lda.
//
// YECHIM: NO_DRIVER zakaz qayta ko'tarilishi mumkin bo'lgan oynada (15 daqiqa)
// `/customer/active` (mini app'da `/miniapp/state` — o'sha metod) uni qaytaradi;
// mijoz yangi zakaz bersa eskisi yopiladi va endi qayta ko'tarilmaydi.
//
// Ishga tushirish: `node scripts/no-driver-restore-sim.mjs`
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
  const telegramId = String(840000000 + Math.floor(Math.random() * 1e6));
  const customer = await j('POST', '/customers/upsert',
    { telegramId, phone: simPhone('+99893'), firstName: 'Kutuvchi' }, INT);
  const started = await j('POST', '/auth/customer/start', { deviceId: 'sim-' + telegramId });
  const conf = await j('POST', '/auth/customer/confirm', { nonce: started.nonce, telegramId }, INT);
  const verified = await j('POST', '/auth/customer/verify', { nonce: started.nonce, code: conf.code });
  return { customerId: customer.id, auth: { authorization: 'Bearer ' + verified.token } };
}

async function main() {
  console.log(`\n=== NO_DRIVER tiklash sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const me = await customerToken();

  // ---- 1: onlayn haydovchi yo'q ----
  console.log('--- 1: taksi topilmadi, mijoz ilovani qayta ochadi ---');
  const first = await j('POST', '/orders', { customerId: me.customerId, category: 'standard', pickup }, INT);
  await sleep(2500);
  const t1 = await call('GET', `/customer/orders/${first.id}`, me.auth);
  check('Taksi topilmadi -> NO_DRIVER', t1.data?.orderStatus === 'NO_DRIVER', JSON.stringify(t1.data?.orderStatus));
  const a1 = await call('GET', '/customer/active', me.auth);
  check('Qayta ochilganda zakaz QAYTARILADI (/customer/active)', a1.data?.orderId === first.id, JSON.stringify(a1.data));
  check('Kuzatuvda: tugamagan va bekor qilsa bo‘ladi',
    t1.data?.finished === false && t1.data?.cancellable === true,
    JSON.stringify({ f: t1.data?.finished, c: t1.data?.cancellable }));

  // ---- 2: mijoz baribir yangi zakaz beradi (masalan botdan) ----
  console.log('\n--- 2: mijoz yangi zakaz beradi ---');
  const second = await call('POST', '/orders', INT, { customerId: me.customerId, category: 'standard', pickup });
  check('Yangi zakaz qabul qilindi', second.status < 300 && !!second.data?.id, `${second.status} ${JSON.stringify(second.data)}`);
  await sleep(2500);
  const old = await call('GET', `/customer/orders/${first.id}`, me.auth);
  check('Eski NO_DRIVER zakaz yopildi', old.data?.finished === true && old.data?.orderStatus === 'CANCELLED_BY_CUSTOMER',
    JSON.stringify(old.data?.orderStatus));
  const a2 = await call('GET', '/customer/active', me.auth);
  check('Faol zakaz — yangisi', a2.data?.orderId === second.data?.id, JSON.stringify(a2.data));

  // ---- 3: haydovchi onlayn bo'ladi ----
  console.log('\n--- 3: haydovchi onlayn bo‘ladi ---');
  const drv = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Qaytgan',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt', seats: 4 },
  });
  const ds = io(API + '/driver', { auth: { token: drv.token }, transports: ['websocket'] });
  await new Promise((r) => ds.on('connect', r));
  const offers = [];
  ds.on('order:offer', (o) => offers.push(o));
  await new Promise((r) => ds.emit('driver:online', {}, r));
  ds.emit('driver:location', pickup);
  await sleep(3000);
  check('Haydovchi yangi zakaz taklifini oldi', offers.some((o) => o.orderId === second.data?.id),
    JSON.stringify(offers.map((o) => o.orderId.slice(0, 8))));
  check('Yopilgan eski zakaz QAYTA KO‘TARILMADI', !offers.some((o) => o.orderId === first.id));

  await j('POST', `/orders/${second.data?.id}/cancel`, { reason: 'sim' }, INT).catch(() => {});
  await sleep(600);
  ds.emit('driver:offline', {});
  await sleep(400);
  ds.close();

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SIM XATOSI:', e); process.exit(1); });
