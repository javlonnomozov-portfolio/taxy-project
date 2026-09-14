// Mijoz jonli kanali: ilova JWT bilan ulanadi (2026-09-14).
//
// MUAMMO: ilova zakaz holatini har 5 soniyada so'rab turardi — safar davomida
// yuzlab so'rov. Jonli kanal bor edi, lekin u FAQAT ichki kalit bilan
// ochilardi (bot backend uchun). Ichki kalitni APK ichiga qo'yib bo'lmaydi —
// u butun ichki API'ni ochadi va fayldan chiqarib olinadi.
//
// YECHIM: `customer.gateway.ts` ga mijoz JWT'si bilan ulanish yo'li qo'shildi.
// Bu sim aynan shu chegarani tekshiradi: to'g'ri token ulanadi va hodisa
// oladi, tokensiz/begona token esa UZILADI.
//
// Ishga tushirish: `node scripts/customer-socket-sim.mjs`
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

/** Ulanish natijasi: `connect` yoki uzilish/xato. */
function tryConnect(auth) {
  const s = io(API + '/customer', { auth, transports: ['websocket'], reconnection: false });
  return new Promise((resolve) => {
    const done = (ok) => resolve({ ok, socket: s });
    s.on('connect', () => setTimeout(() => done(s.connected), 700));
    s.on('connect_error', () => done(false));
    s.on('disconnect', () => done(false));
    setTimeout(() => done(s.connected), 4000);
  });
}

/**
 * Mijoz tokeni — customer-addresses-sim bilan BIR XIL oqim: avval mijoz
 * yaratiladi (`/customers/upsert`), keyin bot tasdiqlash oqimi.
 */
async function customerToken() {
  const telegramId = String(810000000 + Math.floor(Math.random() * 1e6));
  const customer = await j('POST', '/customers/upsert',
    { telegramId, phone: simPhone('+99893'), firstName: 'Mijoz' }, INT);
  const started = await j('POST', '/auth/customer/start', { deviceId: 'sim-' + telegramId });
  const conf = await j('POST', '/auth/customer/confirm', { nonce: started.nonce, telegramId }, INT);
  const verified = await j('POST', '/auth/customer/verify', { nonce: started.nonce, code: conf.code });
  return { token: verified.token, customerId: customer.id };
}

async function main() {
  console.log(`\n=== Mijoz soketi sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const me = await customerToken();
  check('Mijoz tokeni olindi', !!me.token);

  // ---- 1: ruxsatlar ----
  console.log('--- 1: kim ulana oladi ---');
  const good = await tryConnect({ token: me.token });
  check('Mijoz JWT bilan ulanadi', good.ok);
  const events = [];
  good.socket.on('order:status', (e) => events.push(e));

  const anon = await tryConnect({});
  check('Tokensiz ulanib bo‘lmaydi', !anon.ok);
  anon.socket.close();

  const bad = await tryConnect({ token: 'buzuq.token.qiymati' });
  check('Buzuq token bilan ulanib bo‘lmaydi', !bad.ok);
  bad.socket.close();

  const drv = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Nexia',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Nexia', seats: 4 },
  });
  const asDriver = await tryConnect({ token: drv.token });
  check('Haydovchi tokeni mijoz kanaliga kira olmaydi', !asDriver.ok);
  asDriver.socket.close();

  // ---- 2: hodisa yetib boradimi ----
  console.log('\n--- 2: holat o‘zgarishi jonli keladi ---');
  const ds = io(API + '/driver', { auth: { token: drv.token }, transports: ['websocket'] });
  await new Promise((r) => ds.on('connect', r));
  const offers = [];
  ds.on('order:offer', (o) => offers.push(o));
  await new Promise((r) => ds.emit('driver:online', {}, r));
  ds.emit('driver:location', pickup);
  await sleep(900);

  const order = await j('POST', '/orders', { customerId: me.customerId, category: 'standard', pickup }, INT);
  await sleep(2000);
  check('Haydovchiga taklif keldi', offers.some((o) => o.orderId === order.id),
    JSON.stringify(offers.map((o) => o.orderId)));

  ds.emit('driver:offer_response', { orderId: order.id, accept: true }); // ack qaytarmaydi
  await sleep(1500);
  check('Mijozga order:status keldi (so‘rovsiz)', events.length > 0, JSON.stringify(events).slice(0, 200));
  check('Hodisada shu zakaz va ACCEPTED holati',
    events.some((e) => e.orderId === order.id && e.status === 'ACCEPTED'),
    JSON.stringify(events.map((e) => [e.orderId === order.id, e.status])));

  await j('POST', `/orders/${order.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  good.socket.close();
  ds.close();

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SIM XATOSI:', e); process.exit(1); });
