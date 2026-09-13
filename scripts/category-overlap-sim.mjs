// Comfort mashina Standart buyurtmani ham oladi (2026-09-13).
//
// MUAMMO: haydovchi faqat O'Z toifasining Redis geo-indeksida turardi
// (`geo:drivers:<toifa>`). 2026-09-13 da mijoz Standart zakaz berdi, haydovchi
// ishni boshladi, lekin zakaz unga KO'RINMADI — mashinasi Comfort edi.
// Kichik shaharda toifani qat'iy ajratish "taksi topilmadi" degani, bo'sh
// turgan mashina bor bo'lsa ham.
//
// YECHIM: `servedCategories()` — Comfort mashina `comfort` VA `standard`
// indekslarining ikkalasida turadi. Bir tomonlama: Standart mashina Comfort
// zakazni KO'RMAYDI, aks holda Comfort toifasining ma'nosi qolmasdi.
//
// NARX O'ZGARMAYDI: hisob `order.vehicleCategory` (MIJOZ tanlagan toifa)
// bo'yicha chiqadi. Comfort mashina Standart zakazni olsa — mijoz Standart
// narx to'laydi, ya'ni unga ko'rsatilgan narxni. Shu sim aynan shuni
// tekshiradi, chunki bu yerda xato bo'lsa mijoz aldangan bo'lardi.
//
// Ishga tushirish: `node scripts/category-overlap-sim.mjs`
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
// DIQQAT: barcha handlerlar ack qaytarmaydi — `driver:offer_response`
// hech narsa qaytarmaydi (trip:* esa `{ ok: true }` qaytaradi). Ack'siz
// hodisani `await` qilsangiz sim ABADIY qotib qoladi, xato ham bermaydi.
// Shuning uchun kutish muddati bor: 5 soniyada javob kelmasa davom etamiz.
const emit = (s, ev, data) =>
  new Promise((res) => {
    const to = setTimeout(() => res(undefined), 5000);
    s.emit(ev, data, (r) => {
      clearTimeout(to);
      res(r);
    });
  });

/** Ack qaytarmaydigan hodisalar uchun — javob kutilmaydi. */
const fire = (s, ev, data) => s.emit(ev, data);

const newCustomer = (n) =>
  j('POST', '/customers/upsert',
    { telegramId: String(Date.now() + n), phone: simPhone('+99895'), firstName: 'M' + n }, INT);

/** Haydovchi + soket, berilgan MASHINA toifasi bilan. */
async function makeDriver(adminToken, label, category) {
  const d = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: label,
    vehicle: { category, plate: simPlate(), model: label, seats: 4 },
  });
  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  await emit(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  const offers = [];
  s.on('order:offer', (o) => offers.push(o));
  return { ...d, socket: s, offers, label, category };
}

const got = (drv, orderId) => drv.offers.find((o) => o.orderId === orderId);
const clear = (...drvs) => drvs.forEach((d) => (d.offers.length = 0));

async function main() {
  console.log(`\n=== Toifa kesishuvi sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ADM = { authorization: 'Bearer ' + adminToken };

  console.log('--- 3 ta haydovchi: Standart, Comfort, Yuk ---');
  const std = await makeDriver(adminToken, 'Nexia', 'standard');
  const cmf = await makeDriver(adminToken, 'Malibu', 'comfort');
  const crg = await makeDriver(adminToken, 'Labo', 'cargo');
  await sleep(900);

  // ---- 1: STANDART zakaz → Standart ham, Comfort ham; Yuk YO'Q ----
  console.log('\n--- 1: Standart zakaz ---');
  const c1 = await newCustomer(1);
  const o1 = await j('POST', '/orders', { customerId: c1.id, category: 'standard', pickup }, INT);
  await sleep(2000);

  check('Standart mashina taklif oldi', !!got(std, o1.id));
  check('Comfort mashina HAM taklif oldi (asosiy tuzatish)', !!got(cmf, o1.id),
    'comfort takliflari: ' + JSON.stringify(cmf.offers.map((o) => o.orderId)));
  check('Yuk mashinasi taklif OLMADI', !got(crg, o1.id));

  // Haydovchi kartada nimani ko'radi — rang shu maydonga bog'liq.
  check('Taklifda toifa MIJOZNIKI (standard), mashinaniki emas',
    got(cmf, o1.id)?.category === 'standard', JSON.stringify(got(cmf, o1.id)?.category));

  await j('POST', `/orders/${o1.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  clear(std, cmf, crg);

  // ---- 2: COMFORT zakaz → faqat Comfort ----
  console.log('\n--- 2: Comfort zakaz ---');
  const c2 = await newCustomer(2);
  const o2 = await j('POST', '/orders', { customerId: c2.id, category: 'comfort', pickup }, INT);
  await sleep(2000);

  check('Comfort mashina taklif oldi', !!got(cmf, o2.id));
  check('Standart mashina taklif OLMADI (bir tomonlama)', !got(std, o2.id),
    'standart takliflari: ' + JSON.stringify(std.offers.map((o) => o.orderId)));
  check('Yuk mashinasi taklif OLMADI', !got(crg, o2.id));
  check('Taklifda toifa comfort', got(cmf, o2.id)?.category === 'comfort');

  await j('POST', `/orders/${o2.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  clear(std, cmf, crg);

  // ---- 3: YUK zakaz → faqat Yuk ----
  console.log('\n--- 3: Yuk zakaz ---');
  const c3 = await newCustomer(3);
  const o3 = await j('POST', '/orders', { customerId: c3.id, category: 'cargo', pickup }, INT);
  await sleep(2000);

  check('Yuk mashinasi taklif oldi', !!got(crg, o3.id));
  check('Standart taklif OLMADI', !got(std, o3.id));
  check('Comfort taklif OLMADI', !got(cmf, o3.id));

  await j('POST', `/orders/${o3.id}/cancel`, { reason: 'sim' }, INT);
  await sleep(600);
  clear(std, cmf, crg);

  // ---- 4: Comfort mashina Standart zakazni yakunlaydi → STANDART narx ----
  //
  // Eng muhim tekshiruv: mijozga "Standart, 4 000 so'mdan" ko'rsatilgan.
  // Mashina Comfort bo'lgani uchun Comfort tarifi qo'llansa — mijoz aldangan
  // bo'lardi. Ikki tarifni panelda AJRATIB qo'yamiz va farqni o'lchaymiz.
  console.log('\n--- 4: Comfort mashina Standart zakazni bajaradi ---');

  const tariffs = await j('GET', '/ops/tariffs', undefined, ADM);
  const before = Object.fromEntries(tariffs.map((t) => [t.category, t]));
  const put = (cat, body) => j('PUT', `/ops/tariffs/${cat}`, body, ADM);
  // Tanib olinadigan, atayin uzoq qiymatlar.
  await put('standard', {
    baseFare: 5000, perKm: 1000, waitingPerMin: 0, freeWaitMin: 99, nightMultiplier: 1,
  });
  await put('comfort', {
    baseFare: 90000, perKm: 9000, waitingPerMin: 0, freeWaitMin: 99, nightMultiplier: 1,
  });

  const c4 = await newCustomer(4);
  const o4 = await j('POST', '/orders', { customerId: c4.id, category: 'standard', pickup }, INT);
  await sleep(2000);

  const offer4 = got(cmf, o4.id);
  check('Comfort mashina Standart zakaz taklifini oldi', !!offer4);

  if (offer4) {
    fire(cmf.socket, 'driver:offer_response', { orderId: o4.id, accept: true });
    await sleep(900);
    await emit(cmf.socket, 'trip:arrived', { orderId: o4.id });
    await sleep(500);
    await emit(cmf.socket, 'trip:start', { orderId: o4.id });
    await sleep(500);
    // 10 km → standart: 5000 + 10*1000 = 15 000; comfort: 90000 + 10*9000 = 180 000
    await emit(cmf.socket, 'trip:complete', { orderId: o4.id, distanceM: 10000 });
    await sleep(1200);

    const row = await j('GET', `/orders/${o4.id}`, undefined, INT);
    const price = row?.finalPrice ?? null;
    check('Zakaz yakunlandi', row?.status === 'COMPLETED', String(row?.status));

    check('Yakuniy narx STANDART tarifi bo\'yicha (15 000)', Number(price) === 15000,
      `haqiqiy narx: ${price} (comfort bo'lsa 180 000 chiqardi)`);
  }

  // Tariflarni qaytaramiz — sim keyingi simlarni buzmasin.
  for (const cat of ['standard', 'comfort']) {
    const b = before[cat];
    if (b) {
      await put(cat, {
        baseFare: b.baseFare, perKm: b.perKm, waitingPerMin: b.waitingPerMin,
        freeWaitMin: b.freeWaitMin, nightMultiplier: b.nightMultiplier,
      });
    }
  }
  const restored = await j('GET', '/ops/tariffs', undefined, ADM);
  check('Tariflar qaytarildi',
    Number(restored.find((t) => t.category === 'comfort')?.baseFare) === Number(before.comfort?.baseFare),
    JSON.stringify(restored.map((t) => [t.category, t.baseFare])));

  for (const d of [std, cmf, crg]) d.socket.close();

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('SIM XATOSI:', e);
  process.exit(1);
});
