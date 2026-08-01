// "Bot chatida baholash bor, mini app'da yo'q" regressiyasi.
//
// Safar yakunlangach bot chati narxni va 1..5 yulduz tugmalarini ko'rsatardi,
// mini app esa faqat sarlavhani "Safar yakunlandi" ga almashtirib qo'yardi:
// na narx, na baholash. Mijoz bir vaqtning o'zida ikki xil holatni ko'rardi.
//
// Bu sim tekshiradi:
//   - /miniapp/track yakuniy narxni va baholash holatini qaytaradi
//   - /miniapp/rate ishlaydi va faqat EGASIGA ruxsat beradi
//   - bot chatidan berilgan baho mini app'da ham ko'rinadi (va aksincha)
//   - TAKRORIY baho haydovchi reytingini ikki marta hisoblamaydi
//
// API TELEGRAM_BOT_TOKEN bilan ishga tushirilgan bo'lishi kerak.
// Ishga tushirish: `TELEGRAM_BOT_TOKEN=123:TEST node scripts/miniapp-rating-sim.mjs`
import { createHmac } from 'node:crypto';
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123:TEST';
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = (m, p, b, h = {}) => jx(API, m, p, b, h);
const phone = () => '+99891' + Math.floor(1000000 + Math.random() * 8999999);
const plate = () => '01' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(100 + Math.random() * 899);

function signInitData(telegramId, token = TOKEN) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH' + Math.floor(Math.random() * 1e6),
    user: JSON.stringify({ id: Number(telegramId), first_name: 'Mijoz' }),
  };
  const dataCheck = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const p = new URLSearchParams(fields);
  p.set('hash', createHmac('sha256', secret).update(dataCheck).digest('hex'));
  return p.toString();
}

const post = (path, body) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: API },
    body: JSON.stringify(body),
  });

const track = async (initData, orderId) => {
  const r = await post('/miniapp/track', { initData, orderId });
  if (!r.ok) throw new Error('track → ' + r.status + ' ' + (await r.text()));
  return r.json();
};

async function main() {
  console.log(`\n=== Mini App baholash sinxronligi sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);

  const tgId = String(700000000 + Math.floor(Math.random() * 1e6));
  const customer = await j(
    'POST',
    '/customers/upsert',
    { telegramId: tgId, phone: phone(), firstName: 'Mijoz' },
    { 'x-internal-key': KEY },
  );
  const initData = signInitData(tgId);

  const d = await createDriver(API, adminToken, {
    phone: phone(),
    firstName: 'Anvar',
    vehicle: { category: 'standard', plate: plate(), model: 'Cobalt' },
  });
  const ds = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((res) => ds.on('connect', res));
  await new Promise((r) => ds.emit('driver:online', {}, r));
  ds.emit('driver:location', pickup);
  await sleep(600);

  // ---- Safarni to'liq o'tkazamiz ----
  const order = await j(
    'POST',
    '/orders',
    { customerId: customer.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(1300);
  ds.emit('driver:offer_response', { orderId: order.id, accept: true });
  await sleep(800);

  console.log('--- Safar davomida narx/baholash YO\'Q ---');
  const mid = await track(initData, order.id);
  check('Tugamagan safarda finished=false', mid.finished === false, String(mid.finished));
  check('Tugamagan safarda narx yo\'q', mid.finalPrice == null, String(mid.finalPrice));
  check('Tugamagan safarda rated=false', mid.rated === false, String(mid.rated));

  // Baholash safar tugamaguncha rad etilishi kerak.
  const early = await post('/miniapp/rate', { initData, orderId: order.id, score: 5 });
  check('Safar tugamasdan baholash RAD ETILADI', early.status === 400, 'HTTP ' + early.status);

  await new Promise((r) => ds.emit('trip:arrived', { orderId: order.id }, r));
  await new Promise((r) => ds.emit('trip:start', { orderId: order.id }, r));
  await new Promise((r) => ds.emit('trip:complete', { orderId: order.id, distanceM: 3000 }, r));
  await sleep(800);

  console.log('\n--- Yakunlangach: narx va baholash taklifi ---');
  const done = await track(initData, order.id);
  check('finished=true', done.finished === true);
  check('completed=true (bekor emas)', done.completed === true);
  check('Yakuniy narx keldi', typeof done.finalPrice === 'number' && done.finalPrice > 0, String(done.finalPrice));
  check('Hali baholanmagan (rated=false)', done.rated === false, String(done.rated));

  console.log('\n--- Begona odam baholay olmaydi ---');
  const strangerTg = String(Number(tgId) + 777);
  await j('POST', '/customers/upsert', { telegramId: strangerTg, phone: phone(), firstName: 'Begona' }, { 'x-internal-key': KEY });
  const stranger = await post('/miniapp/rate', { initData: signInitData(strangerTg), orderId: order.id, score: 1 });
  check('Begona mijoz → 403', stranger.status === 403, 'HTTP ' + stranger.status);
  const badSig = await post('/miniapp/rate', { initData: signInitData(tgId, '999:BUZUQ'), orderId: order.id, score: 1 });
  check('Buzuq imzo → 403', badSig.status === 403, 'HTTP ' + badSig.status);

  console.log('\n--- Mini app\'dan baholash ---');
  const rate = await post('/miniapp/rate', { initData, orderId: order.id, score: 5 });
  check('Baho qabul qilindi', rate.status === 200, 'HTTP ' + rate.status);
  const afterRate = await track(initData, order.id);
  check('rated=true bo\'ldi', afterRate.rated === true, String(afterRate.rated));

  const st1 = await j('GET', '/drivers/me/stats', undefined, { authorization: 'Bearer ' + d.token });
  check('Haydovchi reytingi 5 bo\'ldi', Number(st1.ratingAvg) === 5, String(st1.ratingAvg));

  console.log('\n--- TAKRORIY baho reytingni buzmaydi ---');
  // Mijoz bot chatidagi tugmani ham bosishi mumkin — o'sha yo'l ichki kalit bilan.
  const again = await post('/miniapp/rate', { initData, orderId: order.id, score: 1 });
  check('Ikkinchi baho xato BERMAYDI', again.status === 200, 'HTTP ' + again.status);
  const botAgain = await fetch(API + '/ratings/customer-to-driver', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-key': KEY },
    body: JSON.stringify({ orderId: order.id, scores: { manners: 1, driving: 1, car_condition: 1, punctuality: 1 } }),
  });
  check('Bot yo\'lidan takroriy baho ham xato bermaydi', botAgain.ok, 'HTTP ' + botAgain.status);
  const st2 = await j('GET', '/drivers/me/stats', undefined, { authorization: 'Bearer ' + d.token });
  check('Reyting HALI HAM 5 (ikki marta hisoblanmadi)', Number(st2.ratingAvg) === 5, String(st2.ratingAvg));

  console.log('\n--- Bot chatidan baholansa mini app KO\'RADI ---');
  const order2 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1300);
  ds.emit('driver:offer_response', { orderId: order2.id, accept: true });
  await sleep(800);
  await new Promise((r) => ds.emit('trip:arrived', { orderId: order2.id }, r));
  await new Promise((r) => ds.emit('trip:start', { orderId: order2.id }, r));
  await new Promise((r) => ds.emit('trip:complete', { orderId: order2.id, distanceM: 2000 }, r));
  await sleep(800);

  const before = await track(initData, order2.id);
  check('Yangi safar hali baholanmagan', before.rated === false, String(before.rated));
  await fetch(API + '/ratings/customer-to-driver', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-key': KEY },
    body: JSON.stringify({ orderId: order2.id, scores: { manners: 4, driving: 4, car_condition: 4, punctuality: 4 } }),
  });
  const after = await track(initData, order2.id);
  check('BOT baholagach mini app rated=true ko\'radi', after.rated === true, String(after.rated));

  console.log('\n--- Mini app\'dan BEKOR QILISH ---');
  const order3 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(700);

  // Haydovchi hali qabul qilmagan — bekor qilish mumkin va jarimasiz bo'lishi kerak.
  const beforeAccept = await track(initData, order3.id);
  check('Qabul qilinmagan zakaz bekor qilinadi (cancellable)', beforeAccept.cancellable === true, String(beforeAccept.cancellable));

  const strangerCancel = await post('/miniapp/cancel', { initData: signInitData(strangerTg), orderId: order3.id });
  check('Begona odam BEKOR QILOLMAYDI → 403', strangerCancel.status === 403, 'HTTP ' + strangerCancel.status);

  const c1 = await post('/miniapp/cancel', { initData, orderId: order3.id });
  check('Bekor qilindi', c1.status === 200, 'HTTP ' + c1.status);
  const c1body = await c1.json();
  check('Jarimasiz (haydovchi biriktirilmagan)', c1body.penalized === false, JSON.stringify(c1body));

  const afterCancel = await track(initData, order3.id);
  check('Holat CANCELLED_BY_CUSTOMER', afterCancel.orderStatus === 'CANCELLED_BY_CUSTOMER', afterCancel.orderStatus);
  check('finished=true', afterCancel.finished === true);
  check('completed=false (baholash so\'ralmaydi)', afterCancel.completed === false);
  check('Endi bekor qilib bo\'lmaydi (cancellable=false)', afterCancel.cancellable === false);

  const twice = await post('/miniapp/cancel', { initData, orderId: order3.id });
  check('Ikkinchi bekor RAD ETILADI', twice.status === 400, 'HTTP ' + twice.status);

  console.log('\n--- Safar BOSHLANGACH bekor qilib bo\'lmaydi ---');
  const order4 = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
  await sleep(1300);
  ds.emit('driver:offer_response', { orderId: order4.id, accept: true });
  await sleep(800);
  const accepted = await track(initData, order4.id);
  check('Qabul qilingach hali bekor qilinadi', accepted.cancellable === true, String(accepted.cancellable));

  await new Promise((r) => ds.emit('trip:arrived', { orderId: order4.id }, r));
  await new Promise((r) => ds.emit('trip:start', { orderId: order4.id }, r));
  await sleep(600);
  const inProgress = await track(initData, order4.id);
  check('IN_PROGRESS da cancellable=false', inProgress.cancellable === false, inProgress.orderStatus);
  const late = await post('/miniapp/cancel', { initData, orderId: order4.id });
  check('IN_PROGRESS da bekor RAD ETILADI', late.status === 400, 'HTTP ' + late.status);
  await new Promise((r) => ds.emit('trip:complete', { orderId: order4.id, distanceM: 1000 }, r));
  await sleep(500);

  ds.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
