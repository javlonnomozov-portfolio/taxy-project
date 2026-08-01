// "Ilova yopildi — safar yo'qoldi" regressiyasi.
//
// Safar holati FAQAT ilova xotirasida edi. Android ilovani fonda o'ldirsa
// (haydovchi "Yo'l ko'rsatish" bosib Yandex Xaritaga o'tganda odatiy hol) yoki
// telefon o'chsa, ilova qayta ochilganda "Ishni boshlash" ekraniga qaytardi:
// safar yo'qolar, haydovchi uni yakunlay olmas, serverda esa zakaz faol qolardi.
//
// Tuzatish: `GET /trips/active` — haydovchining hozirgi safari (yo'q bo'lsa null).
// Bu sim ilovaning qayta ishga tushishini soketni UZIB, yangi ulanish ochib
// taqlid qiladi va har bosqichda holat tiklanishini tekshiradi.
//
// Ishga tushirish: `node scripts/trip-resume-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx } from './helpers.mjs';

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
  const bag = { offers: [], assigned: [] };
  const s = io(API + '/driver', { auth: { token }, transports: ['websocket'] });
  s.on('order:offer', (o) => bag.offers.push(o));
  s.on('order:assigned', (o) => bag.assigned.push(o));
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
      showName: true,
    },
    { 'x-internal-key': KEY },
  );
}

const active = (token) =>
  j('GET', '/trips/active', undefined, { authorization: 'Bearer ' + token }).then((r) => r.trip);

// Har ishga tushirishda yangi raqam — sim qayta-qayta ishlatiladi, qat'iy
// raqamlar ikkinchi safar "haydovchi allaqachon mavjud" bilan yiqilardi.
const phone = () => '+99891' + Math.floor(1000000 + Math.random() * 8999999);
const plate = () => '01' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(100 + Math.random() * 899);

async function main() {
  console.log(`\n=== "Ilova yopildi — safar tiklanadi" sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const d = await createDriver(API, adminToken, {
    phone: phone(),
    firstName: 'Aziz',
    vehicle: { category: 'standard', plate: plate(), model: 'Nexia' },
  });

  // ---- 0: safar yo'q — null qaytishi kerak ----
  console.log('--- 0: safarsiz holat ---');
  const none = await active(d.token);
  check('Safar yo\'q ekan null qaytadi', none === null || none === undefined, JSON.stringify(none));

  // ---- 1: zakaz qabul qilindi ----
  console.log('\n--- 1: zakaz qabul qilindi ---');
  let { s, bag } = await connectDriver(d.token);
  const c1 = await newCustomer(1);
  const o1 = await j(
    'POST',
    '/orders',
    { customerId: c1.id, category: 'standard', pickup, destination: { lat: 41.32, lng: 69.25 } },
    { 'x-internal-key': KEY },
  );
  await sleep(1500);
  check('Taklif keldi', bag.offers.some((o) => o.orderId === o1.id));
  s.emit('driver:offer_response', { orderId: o1.id, accept: true });
  await sleep(900);
  check('order:assigned keldi', bag.assigned.some((a) => a.orderId === o1.id));

  // ---- 2: ILOVA O'LDIRILDI (soket uzildi, yangi ulanish) ----
  console.log('\n--- 2: ilova o\'ldirildi va qayta ochildi ---');
  s.close();
  await sleep(500);
  const a1 = await active(d.token);
  check('Faol safar tiklandi', !!a1 && a1.orderId === o1.id, JSON.stringify(a1));
  check('Bosqich = accepted', a1?.stage === 'accepted', a1?.stage);
  check('Olib ketish nuqtasi bor', a1?.pickup?.lat === pickup.lat, JSON.stringify(a1?.pickup));
  check('Manzil bor', a1?.dest?.lat === 41.32, JSON.stringify(a1?.dest));
  check('Mijoz telefoni bor', typeof a1?.customer?.phone === 'string' && a1.customer.phone.length > 0);
  check('Tarif (taksometr) bor', typeof a1?.meterConfig?.baseFare === 'number', JSON.stringify(a1?.meterConfig));

  // ---- 3: "Yetib keldim" → bosqich tiklanishi ham yangilanadi ----
  console.log('\n--- 3: bosqich o\'zgargach ham to\'g\'ri tiklanadi ---');
  ({ s, bag } = await connectDriver(d.token));
  await emit(s, 'trip:arrived', { orderId: o1.id });
  await sleep(600);
  s.close();
  await sleep(400);
  const a2 = await active(d.token);
  check('Bosqich = arrived', a2?.stage === 'arrived', a2?.stage);

  // ---- 4: safar boshlandi ----
  ({ s, bag } = await connectDriver(d.token));
  await emit(s, 'trip:start', { orderId: o1.id });
  await sleep(600);
  s.close();
  await sleep(400);
  const a3 = await active(d.token);
  check('Bosqich = in_progress', a3?.stage === 'in_progress', a3?.stage);
  check('startedAt to\'ldirilgan', !!a3?.startedAt, String(a3?.startedAt));

  // ---- 5: safar yakunlandi — endi null ----
  console.log('\n--- 5: yakunlangach faol safar qolmaydi ---');
  ({ s, bag } = await connectDriver(d.token));
  await emit(s, 'trip:complete', { orderId: o1.id, distanceM: 3000 });
  await sleep(800);
  const a4 = await active(d.token);
  check('Yakunlangach null', a4 === null || a4 === undefined, JSON.stringify(a4));
  s.close();

  // ---- 6: BEGONA safar ko'rinmasligi kerak ----
  console.log('\n--- 6: boshqa haydovchining safari ko\'rinmaydi ---');
  const d2 = await createDriver(API, adminToken, {
    phone: phone(),
    firstName: 'Bek',
    vehicle: { category: 'standard', plate: plate(), model: 'Spark' },
  });
  const { s: s2, bag: bag2 } = await connectDriver(d2.token);
  const c2 = await newCustomer(2);
  const o2 = await j('POST', '/orders', { customerId: c2.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1500);
  if (bag2.offers.some((o) => o.orderId === o2.id)) {
    s2.emit('driver:offer_response', { orderId: o2.id, accept: true });
    await sleep(900);
  }
  const mine = await active(d.token);
  check('Birinchi haydovchida safar YO\'Q', mine === null || mine === undefined, JSON.stringify(mine));
  const theirs = await active(d2.token);
  check('Ikkinchi haydovchida safar BOR', !!theirs && theirs.orderId === o2.id, JSON.stringify(theirs));
  s2.close();

  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
