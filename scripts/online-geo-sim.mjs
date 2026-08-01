// "Onlayn, lekin taklif kelmaydi" regressiyasi.
//
// Haqiqiy holat (prod'da uchradi): haydovchi ilovada yashil "Onlayn" turadi, botdan
// zakaz keladi, lekin unga taklif BORMAYDI. Sabab: dispatch faqat Redis geo-indeksidan
// qidiradi, indeksga esa haydovchi faqat `driver:location` kelganda tushadi. Har
// uzilish/oflayn haydovchini indeksdan chiqarib yuboradi, `driver:online` esa uni
// QAYTARMASDI — telefon qimirlamasa yangi GPS nuqtasi ham kelmaydi.
//
// Ishga tushirish: API ishlab turgan holda `node scripts/online-geo-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, simPhone, simPlate } from './helpers.mjs';

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

function connect(token, bag) {
  const s = io(API + '/driver', { auth: { token }, transports: ['websocket'] });
  s.on('order:offer', (o) => bag.offers.push(o));
  return new Promise((res, rej) => {
    s.on('connect', () => res(s));
    s.on('connect_error', rej);
  });
}

async function main() {
  console.log(`\n=== "Onlayn, lekin taklif yo'q" sim (API: ${API}) ===\n`);

  const adminToken = await adminLogin(API);
  const d = await createDriver(API, adminToken, {
    phone: simPhone(),
    firstName: 'Geo',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt' },
  });

  const bag = { offers: [] };
  let s = await connect(d.token, bag);

  // 1) Odatdagi ish kuni boshi: onlayn + GPS nuqtasi keldi.
  await new Promise((r) => s.emit('driver:online', {}, r));
  s.emit('driver:location', { lat: pickup.lat, lng: pickup.lng });
  await sleep(500);

  // 2) Ilova uzildi / haydovchi "Ishni tugatish" bosdi → indeksdan chiqadi.
  await new Promise((r) => s.emit('driver:offline', {}, r));
  s.close();
  await sleep(300);

  // 3) Qayta ulandi va yana onlayn bo'ldi — LEKIN telefon qimirlamagani uchun
  //    yangi GPS nuqtasi YO'Q. Aynan shu holat prod'da sindi.
  bag.offers = [];
  s = await connect(d.token, bag);
  await new Promise((r) => s.emit('driver:online', {}, r));
  await sleep(500);

  // 4) Mijoz botdan zakaz beradi.
  const customer = await j(
    'POST',
    '/customers/upsert',
    { telegramId: String(Date.now()), phone: simPhone(), firstName: 'Sim' },
    { 'x-internal-key': KEY },
  );
  const order = await j(
    'POST',
    '/orders',
    { customerId: customer.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(1500);

  check(
    'Joylashuv qayta yuborilmasa ham onlayn haydovchi taklif oldi',
    bag.offers.some((o) => o.orderId === order.id),
  );

  const state = await j('GET', `/orders/${order.id}`, undefined, { 'x-internal-key': KEY }).catch(
    () => null,
  );
  if (state) console.log(`  (zakaz holati: ${state.status})`);

  s.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Sim xato:', e.message);
  process.exit(1);
});
