// "Zakaz oldin, haydovchi keyin" regressiyasi.
//
// Kechqurun bitta ham taksi onlayn bo'lmasligi mumkin. O'shanda zakaz NO_DRIVER'da
// qoladi. Ilgari uni qayta ko'taradigan hech narsa yo'q edi: haydovchi keyin onlayn
// bo'lsa ham kutib turgan zakazdan bexabar qolardi, mijoz esa javobsiz.
//
// Bu sim ikkita yo'lni tekshiradi:
//   1) haydovchi keyin onlayn bo'ldi   → avtomatik qayta taklif keladi
//   2) operator qo'lda biriktirdi      → MIJOZ socketiga ACCEPTED yetib boradi
//      (bot aynan shu eventni o'tkazib yuborardi — NO_DRIVER'da socketni yopardi)
//
// Ishga tushirish: API ishlab turgan holda `node scripts/late-driver-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0;
let failed = 0;
const check = (name, cond) => {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function j(method, path, body, headers = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

function connectDriver(token, bag) {
  const s = io(API + '/driver', { auth: { token }, transports: ['websocket'] });
  s.on('order:offer', (o) => bag.offers.push(o));
  s.on('order:assigned', (o) => bag.assigned.push(o));
  return new Promise((res, rej) => {
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
}

function connectCustomer(customerId) {
  const s = io(API + '/customer', {
    auth: { customerId, internalKey: KEY },
    transports: ['websocket'],
  });
  const statuses = [];
  s.on('order:status', (x) => statuses.push(x));
  return new Promise((res) => s.on('connect', () => res({ socket: s, statuses })));
}

const newCustomer = () =>
  j(
    'POST',
    '/customers/upsert',
    {
      // telegram_id — bigint, butun son bo'lishi shart.
      telegramId: String(Date.now() + Math.floor(Math.random() * 1000)),
      phone: '+99890000' + Math.floor(1000 + Math.random() * 8999),
      firstName: 'Sim',
    },
    { 'x-internal-key': KEY },
  );

async function main() {
  console.log(`\n=== "Zakaz oldin, haydovchi keyin" sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);

  // ---- 1-yo'l: haydovchi keyin onlayn bo'ladi -------------------------------
  console.log('--- Test 1: haydovchi zakazdan KEYIN onlayn boldi ---');
  const c1 = await newCustomer();
  const cs1 = await connectCustomer(c1.id);

  // Hech kim onlayn emas — zakaz NO_DRIVER'ga tushishi kerak.
  const o1 = await j(
    'POST',
    '/orders',
    { customerId: c1.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(1500);
  const st1 = await j('GET', `/orders/${o1.id}`, undefined, { 'x-internal-key': KEY });
  check('Haydovchi yo\'q ekan — zakaz NO_DRIVER bo\'ldi', st1.status === 'NO_DRIVER');

  // Endi haydovchi ishga chiqadi.
  const d1 = await createDriver(API, adminToken, {
    phone: '+998915551001',
    firstName: 'Kech',
    vehicle: { category: 'standard', plate: '01L001', model: 'Cobalt' },
  });
  const bag1 = { offers: [], assigned: [] };
  const ds1 = await connectDriver(d1.token, bag1);
  await new Promise((r) => ds1.emit('driver:online', {}, r));
  ds1.emit('driver:location', { lat: pickup.lat, lng: pickup.lng });
  await sleep(2000);

  check(
    'Kutib turgan zakaz kech onlayn bo\'lgan haydovchiga taklif qilindi',
    bag1.offers.some((o) => o.orderId === o1.id),
  );

  // Qabul qilsa — odatdagi oqim ishlashi kerak.
  ds1.emit('driver:offer_response', { orderId: o1.id, accept: true });
  await sleep(900);
  check('Qabul qilgach haydovchi order:assigned oldi', bag1.assigned.some((a) => a.orderId === o1.id));
  check(
    'Mijoz ACCEPTED va haydovchi kartasini oldi',
    cs1.statuses.some((x) => x.orderId === o1.id && x.status === 'ACCEPTED' && x.driver),
  );

  // ---- 2-yo'l: operator qo'lda biriktiradi ----------------------------------
  console.log('\n--- Test 2: NO_DRIVER zakazga operator haydovchi biriktirdi ---');
  // 1-testdagi haydovchini maydondan olib tashlaymiz, aks holda 2-zakazni u oladi
  // va NO_DRIVER holati umuman yuzaga kelmaydi.
  await new Promise((r) => ds1.emit('driver:offline', {}, r));
  await sleep(300);

  const c2 = await newCustomer();
  const cs2 = await connectCustomer(c2.id);

  // Birinchi haydovchi endi safarda — yana hech kim yo'q.
  const o2 = await j(
    'POST',
    '/orders',
    { customerId: c2.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(1500);
  const st2 = await j('GET', `/orders/${o2.id}`, undefined, { 'x-internal-key': KEY });
  check('Zakaz NO_DRIVER bo\'ldi', st2.status === 'NO_DRIVER');

  const d2 = await createDriver(API, adminToken, {
    phone: '+998915551002',
    firstName: 'Operator',
    vehicle: { category: 'standard', plate: '01L002', model: 'Nexia' },
  });
  const bag2 = { offers: [], assigned: [] };
  const ds2 = await connectDriver(d2.token, bag2);
  await new Promise((r) => ds2.emit('driver:online', {}, r));
  await sleep(300);

  // Operator qo'lda biriktiradi (admin panelidagi "biriktirish" tugmasi).
  await j('POST', `/ops/orders/${o2.id}/assign`, { driverId: d2.driverId }, {
    authorization: 'Bearer ' + adminToken,
  });
  await sleep(900);

  check('Haydovchiga biriktirildi', bag2.assigned.some((a) => a.orderId === o2.id));
  check(
    'MIJOZGA ham ACCEPTED yetib bordi (bot shu eventni o\'tkazib yuborardi)',
    cs2.statuses.some((x) => x.orderId === o2.id && x.status === 'ACCEPTED'),
  );

  ds1.close();
  ds2.close();
  cs1.socket.close();
  cs2.socket.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Sim xato:', e.message);
  process.exit(1);
});
