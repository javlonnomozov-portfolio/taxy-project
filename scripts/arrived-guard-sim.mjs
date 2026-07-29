// "Yetib keldim" himoyasi regressiyasi.
//
// Bu tugma ikki narsani qiladi: kutish soatini ishga tushiradi (mijoz pul to'laydi)
// va mijozga "Taksi yetib keldi" xabarini yuboradi. Ilgari joylashuv UMUMAN
// tekshirilmasdi — haydovchi yo'lda turib bosib, mijozni ham ko'chada kuttirar,
// ham ortiqcha pul yozdirardi.
//
// API `ARRIVED_GEOFENCE_M` bilan ishga tushirilgan bo'lsin (default 150).
// Ishga tushirish: `node scripts/arrived-guard-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const GEOFENCE_M = Number(process.env.ARRIVED_GEOFENCE_M || 150);

const pickup = { lat: 41.311, lng: 69.24 };
// ~1.1 km shimolda — geofence'dan aniq tashqarida.
const farAway = { lat: 41.321, lng: 69.24 };
// ~40 m — geofence ichida (GPS xatosi darajasida).
const atPickup = { lat: 41.31136, lng: 69.24 };

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${extra}`);
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

/** Socket amali — ack'ni (xato bo'lsa `{ok:false,message}`) qaytaradi. */
const emit = (s, ev, data) => new Promise((res) => s.emit(ev, data, res));

async function main() {
  console.log(`\n=== "Yetib keldim" himoyasi sim (geofence: ${GEOFENCE_M} m) ===\n`);
  const adminToken = await adminLogin(API);

  const customer = await j(
    'POST',
    '/customers/upsert',
    { telegramId: String(Date.now()), phone: '+998901119988', firstName: 'Mijoz' },
    { 'x-internal-key': KEY },
  );

  const d = await createDriver(API, adminToken, {
    phone: '+998915553001',
    firstName: 'Sardor',
    vehicle: { category: 'standard', plate: '01G500', model: 'Cobalt' },
  });

  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  const offers = [];
  s.on('order:offer', (o) => offers.push(o));
  await new Promise((res) => s.on('connect', res));
  await emit(s, 'driver:online', {});

  // Haydovchi hozircha UZOQDA turibdi.
  s.emit('driver:location', farAway);
  await sleep(600);

  const order = await j(
    'POST',
    '/orders',
    { customerId: customer.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(1500);
  check('Uzoqdagi haydovchi taklif oldi', offers.some((o) => o.orderId === order.id));
  // DIQQAT: `driver:offer_response` handleri qiymat QAYTARMAYDI, ya'ni Socket.IO
  // ack callback'ini chaqirmaydi. Uni `await emit(...)` bilan kutsangiz sim
  // abadiy osilib qoladi (ilova ham bu yerda ack kutmaydi).
  s.emit('driver:offer_response', { orderId: order.id, accept: true });
  await sleep(900);

  console.log('--- 1: uzoqdan "Yetib keldim" ---');
  const far = await emit(s, 'trip:arrived', { orderId: order.id });
  check('Uzoqdan bosilgan "Yetib keldim" RAD ETILDI', far && far.ok === false, JSON.stringify(far));
  check(
    'Xato xabarida masofa ko\'rsatilgan',
    !!far && typeof far.message === 'string' && /km|m\b/.test(far.message),
    far && far.message,
  );

  const stillAccepted = await j('GET', `/orders/${order.id}`, undefined, { 'x-internal-key': KEY });
  check(
    'Zakaz holati O\'ZGARMADI (ARRIVED ga o\'tmadi)',
    stillAccepted.status === 'ACCEPTED',
    stillAccepted.status,
  );

  console.log('\n--- 2: yetib kelgach ---');
  s.emit('driver:location', atPickup);
  await sleep(700);
  const near = await emit(s, 'trip:arrived', { orderId: order.id });
  check('Nuqtada bosilgan "Yetib keldim" QABUL QILINDI', !!near && near.ok === true, JSON.stringify(near));

  const arrived = await j('GET', `/orders/${order.id}`, undefined, { 'x-internal-key': KEY });
  check('Zakaz ARRIVED bo\'ldi', arrived.status === 'ARRIVED', arrived.status);

  console.log('\n--- 3: safar odatdagidek davom etadi ---');
  const started = await emit(s, 'trip:start', { orderId: order.id });
  check('Safar boshlandi', !!started && started.ok === true);
  const done = await emit(s, 'trip:complete', { orderId: order.id, distanceM: 3000 });
  check('Safar yakunlandi va narx hisoblandi', !!done && typeof done.finalPrice === 'number', JSON.stringify(done));

  s.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Sim xato:', e.message);
  process.exit(1);
});
