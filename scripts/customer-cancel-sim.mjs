// "Mijoz bekor qildi, ammo taksida taklif turib qoldi" regressiyasi.
//
// Mijoz bekor qilganda dispatch TO'XTATILMASDI: taklif haydovchilar ekranida
// taymer bilan turib qolardi va hatto yangi haydovchilarga ham yuborilardi.
// Operatorning `close()` metodi `dispatch.abort()` chaqirardi, mijoz yo'lida esa
// tushib qolgan edi.
//
// Ishga tushirish: `node scripts/customer-cancel-sim.mjs`
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

async function connectDriver(token) {
  const bag = { offers: [], cancels: [], ended: [] };
  const s = io(API + '/driver', { auth: { token }, transports: ['websocket'] });
  s.on('order:offer', (o) => bag.offers.push(o));
  s.on('order:offer_cancelled', (o) => bag.cancels.push(o));
  s.on('trip:ended', (o) => bag.ended.push(o));
  await new Promise((res) => s.on('connect', res));
  await emit(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  await sleep(600);
  return { s, bag };
}

async function newCustomer(suffix) {
  return j(
    'POST',
    '/customers/upsert',
    {
      telegramId: String(Date.now() + suffix),
      phone: '+99893' + Math.floor(1000000 + Math.random() * 8999999),
      firstName: 'Mijoz',
    },
    { 'x-internal-key': KEY },
  );
}

async function main() {
  console.log(`\n=== "Mijoz bekor qildi" sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const d = await createDriver(API, adminToken, {
    phone: simPhone(),
    firstName: 'Rustam',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt' },
  });
  const { s, bag } = await connectDriver(d.token);

  // ---- 1: taklif turgan paytda bekor qilish (haydovchi hali qabul qilmagan) ----
  console.log('--- 1: taklif kutilyapti, mijoz bekor qildi ---');
  const c1 = await newCustomer(1);
  const o1 = await j('POST', '/orders', { customerId: c1.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1500);
  check('Haydovchiga taklif keldi', bag.offers.some((o) => o.orderId === o1.id));

  bag.cancels.length = 0;
  await j('POST', `/orders/${o1.id}/cancel`, { reason: 'sim' }, { 'x-internal-key': KEY });
  await sleep(900);

  check(
    'TAKLIF HAYDOVCHI EKRANIDAN OLINDI (order:offer_cancelled)',
    bag.cancels.some((c) => c.orderId === o1.id),
    JSON.stringify(bag.cancels),
  );
  const st1 = await j('GET', `/orders/${o1.id}`, undefined, { 'x-internal-key': KEY });
  check('Zakaz CANCELLED_BY_CUSTOMER', st1.status === 'CANCELLED_BY_CUSTOMER', st1.status);

  // Dispatch to'xtaganini isbotlaymiz: haydovchi endi yana BO'SH bo'lishi kerak,
  // ya'ni keyingi zakazni olishi kerak.
  console.log('\n--- 2: haydovchi keyingi zakazni oladi (dispatch tozalangan) ---');
  const c2 = await newCustomer(2);
  bag.offers.length = 0;
  const o2 = await j('POST', '/orders', { customerId: c2.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1500);
  check('Yangi taklif keldi', bag.offers.some((o) => o.orderId === o2.id));

  // ---- 3: qabul qilingandan keyin bekor qilish → trip:ended ----
  console.log('\n--- 3: haydovchi qabul qilgach mijoz bekor qildi ---');
  s.emit('driver:offer_response', { orderId: o2.id, accept: true });
  await sleep(900);
  bag.ended.length = 0;
  await j('POST', `/orders/${o2.id}/cancel`, { reason: 'sim' }, { 'x-internal-key': KEY });
  await sleep(900);
  check(
    'Haydovchiga trip:ended keldi (safar ekrani yopiladi)',
    bag.ended.some((e) => e.orderId === o2.id),
    JSON.stringify(bag.ended),
  );

  // Haydovchi yana bo'sh — uchinchi zakazni olishi kerak.
  const c3 = await newCustomer(3);
  bag.offers.length = 0;
  const o3 = await j('POST', '/orders', { customerId: c3.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1500);
  check('Bekor qilingandan keyin haydovchi yana bo\'sh', bag.offers.some((o) => o.orderId === o3.id));

  s.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
