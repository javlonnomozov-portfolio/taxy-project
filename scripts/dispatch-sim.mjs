// Dispatch simulyatsiyasi — Sprint 1 tekshiruvi.
// Haydovchi ilova hali yo'q, shuning uchun haydovchilarni socket orqali simulyatsiya qilamiz.
// Ishga tushirish: API ishlab turgan holda `node scripts/dispatch-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const pickup = { lat: 41.311, lng: 69.24 };
const N = 8;
const WINDOW = Number(process.env.DISPATCH_WINDOW_SIZE || 6);

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}
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

function connectDriver(d) {
  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  d.socket = s;
  d.offers = [];
  d.cancels = [];
  d.assigned = null;
  s.on('order:offer', (o) => d.offers.push(o));
  s.on('order:offer_cancelled', (o) => d.cancels.push(o));
  s.on('order:assigned', (o) => (d.assigned = o));
  return new Promise((res, rej) => {
    s.on('connect', res);
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

async function main() {
  console.log(`\n=== TTY Dispatch simulyatsiyasi (API: ${API}) ===\n`);

  // 1) Mijoz
  const customer = await j(
    'POST',
    '/customers/upsert',
    { telegramId: String(Date.now()), phone: '+998900000001', firstName: 'Sim', lastName: 'Mijoz' },
    { 'x-internal-key': KEY },
  );

  // 2) Haydovchilar (super-admin qo'shadi → temp parol → login)
  const adminToken = await adminLogin(API);
  const drivers = [];
  for (let i = 0; i < N; i++) {
    const phone = '+99891000' + String(i).padStart(4, '0');
    const d = await createDriver(API, adminToken, {
      phone,
      firstName: 'Haydovchi' + i,
      vehicle: { category: 'standard', plate: '01A' + i, model: 'Cobalt' },
    });
    drivers.push({ i, phone, token: d.token, driverId: d.driverId, lng: pickup.lng + i * 0.0008 });
  }
  console.log(`${N} ta haydovchi ro'yxatdan o'tdi, mijoz tayyor.\n`);

  // 3) Socketlar: haydovchilar online + joylashuv
  await Promise.all(drivers.map(connectDriver));
  for (const d of drivers) {
    await new Promise((r) => d.socket.emit('driver:online', {}, r));
    d.socket.emit('driver:location', { lat: pickup.lat, lng: d.lng });
  }
  const cust = await connectCustomer(customer.id);
  await sleep(700); // geo indeks to'lishi uchun

  // 4) Buyurtma yaratish
  console.log('--- Test 1: eng yaqin ' + WINDOW + ' haydovchiga taklif ---');
  const order = await j(
    'POST',
    '/orders',
    { customerId: customer.id, category: 'standard', pickup, note: '2 yo\'lovchi' },
    { 'x-internal-key': KEY },
  );
  await sleep(800);

  const offeredNow = drivers.filter((d) => d.offers.some((o) => o.orderId === order.id));
  check(`Aynan ${WINDOW} ta haydovchi taklif oldi (keldi: ${offeredNow.length})`, offeredNow.length === WINDOW);
  check(
    'Taklif olganlar — eng yaqin haydovchilar (0..' + (WINDOW - 1) + ')',
    offeredNow.every((d) => d.i < WINDOW),
  );
  check('Eng uzoq haydovchilar taklif olmadi', drivers.filter((d) => d.i >= WINDOW).every((d) => d.offers.length === 0));

  // 5) Otmen → keyingi haydovchi qo'shiladi
  console.log('\n--- Test 2: otmen → keyingi eng yaqin haydovchi ---');
  const decliner = offeredNow[0];
  decliner.socket.emit('driver:offer_response', { orderId: order.id, accept: false });
  await sleep(700);
  const nextDriver = drivers.find((d) => d.i === WINDOW); // #6
  check(`Otmendan keyin keyingi haydovchi (#${WINDOW}) taklif oldi`, !!nextDriver && nextDriver.offers.some((o) => o.orderId === order.id));

  // 6) Qabul qilish → biriktirish
  console.log('\n--- Test 3: qabul qilish → atomik biriktirish ---');
  const accepter = drivers.find((d) => d.i === 1); // hali taklifda turgan
  accepter.socket.emit('driver:offer_response', { orderId: order.id, accept: true });
  await sleep(800);

  check('Qabul qilgan haydovchi order:assigned oldi', !!accepter.assigned && accepter.assigned.orderId === order.id);
  const others = drivers.filter((d) => d !== accepter && d.offers.some((o) => o.orderId === order.id));
  check('Boshqa taklif olganlar order:offer_cancelled oldi', others.every((d) => d.cancels.some((c) => c.orderId === order.id)));
  const accStatus = cust.statuses.find((s) => s.orderId === order.id && s.status === 'ACCEPTED');
  check('Mijoz ACCEPTED statusini oldi', !!accStatus);
  check('Mijozga haydovchi kartasi keldi (raqam bilan)', !!accStatus?.driver?.phone);

  // 7) Haydovchi topilmasa: backendda NO_DRIVER, LEKIN mijozga avto xabar yubormaydi
  //    (dispatcher/operator hal qiladi — mijozlarni yo'qotmaslik uchun).
  console.log('\n--- Test 4: haydovchi topilmasa NO_DRIVER (dispatcher nazorati) ---');
  const customer2 = await j(
    'POST',
    '/customers/upsert',
    { telegramId: String(Date.now() + 1), phone: '+998900000002', firstName: 'Sim2' },
    { 'x-internal-key': KEY },
  );
  const cust2 = await connectCustomer(customer2.id);
  await sleep(200);
  const order2 = await j(
    'POST',
    '/orders',
    { customerId: customer2.id, category: 'cargo', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(800);
  const ord2 = await j('GET', '/orders/' + order2.id, undefined, { 'x-internal-key': KEY });
  check('Cargo buyurtma backendda NO_DRIVER bo\'ldi', ord2.status === 'NO_DRIVER');
  const custGotNoDriver = cust2.statuses.some((s) => s.orderId === order2.id && s.status === 'NO_DRIVER');
  check('Mijozga avto NO_DRIVER YUBORILMADI (dispatcher hal qiladi)', !custGotNoDriver);

  // Yakun
  console.log(`\n=== Natija: ${passed} ✅ / ${failed} ❌ ===\n`);
  drivers.forEach((d) => d.socket.close());
  cust.socket.close();
  cust2.socket.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SIM XATO:', e.message);
  process.exit(1);
});
