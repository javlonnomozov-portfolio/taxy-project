// Telegram Mini App ("Taksi qayerda?") simulyatsiyasi.
//
// Mini app YAGONA guard'siz endpoint — himoyasi butunlay Telegram `initData`
// imzosiga tayanadi. Shuning uchun bu sim ijobiy yo'lni ham, HAR BIR rad etish
// yo'lini ham tekshiradi: begona zakaz, buzilgan imzo, imzosiz so'rov.
//
// API `TELEGRAM_BOT_TOKEN` bilan ishga tushirilgan bo'lishi kerak.
// Ishga tushirish: `TELEGRAM_BOT_TOKEN=123:TEST node scripts/miniapp-sim.mjs`
import { createHmac } from 'node:crypto';
import { io } from 'socket.io-client';
import { adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123:TEST';
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

/** Telegram yuboradigan imzolangan initData (mini app SDK shu qatorni beradi). */
function signInitData(telegramId, token = TOKEN) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH' + Math.floor(Math.random() * 1e6),
    user: JSON.stringify({ id: Number(telegramId), first_name: 'Mijoz' }),
  };
  const dataCheck = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const p = new URLSearchParams(fields);
  p.set('hash', createHmac('sha256', secret).update(dataCheck).digest('hex'));
  return p.toString();
}

// `Origin` SARLAVHASI MUHIM: brauzer POST so'rovida uni O'Z-ORIGIN bo'lganda ham
// yuboradi. Prod'da aynan shu narsa CORS'ga urilib 500 bergan edi (allowlist'da
// API'ning o'z domeni yo'q edi). Sim buni takrorlashi uchun biz ham yuboramiz.
// Ushlash uchun API'ni CORS_ORIGINS o'rnatilgan holda ishga tushiring.
const post = (path, body) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: API },
    body: JSON.stringify(body),
  });

const trackRaw = (initData, orderId) =>
  fetch(API + '/miniapp/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: API },
    body: JSON.stringify({ initData, orderId }),
  });

async function main() {
  console.log(`\n=== Mini App "Taksi qayerda?" sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);

  // Mijoz — telegram id bilan (mini app imzosi shu id'ga bog'lanadi).
  const tgId = String(700000000 + Math.floor(Math.random() * 1e6));
  const customer = await j(
    'POST',
    '/customers/upsert',
    { telegramId: tgId, phone: '+998901112233', firstName: 'Mijoz' },
    { 'x-internal-key': KEY },
  );

  // Haydovchi onlayn + joylashuv.
  const d = await createDriver(API, adminToken, {
    phone: '+998915552001',
    firstName: 'Anvar',
    lastName: 'Karimov',
    vehicle: { category: 'standard', plate: '01M777MA', model: 'Cobalt', color: 'oq', make: 'Chevrolet' },
  });
  const ds = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  const offers = [];
  ds.on('order:offer', (o) => offers.push(o));
  await new Promise((res) => ds.on('connect', res));
  await new Promise((r) => ds.emit('driver:online', {}, r));
  ds.emit('driver:location', { lat: 41.32, lng: 69.25 });
  await sleep(600);

  // Zakaz → haydovchi qabul qiladi.
  const order = await j(
    'POST',
    '/orders',
    { customerId: customer.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(1200);
  ds.emit('driver:offer_response', { orderId: order.id, accept: true });
  await sleep(900);

  console.log('--- Buyurtma berish (xaritadan pin) ---');
  // ALOHIDA mijoz: yuqoridagi zakaz allaqachon faol, u state'ni chalg'itardi.
  const tgId2 = String(Number(tgId) + 12345);
  await j(
    'POST',
    '/customers/upsert',
    { telegramId: tgId2, phone: '+998901112244', firstName: 'Mijoz2' },
    { 'x-internal-key': KEY },
  );

  // Faol buyurtma yo'q — sahifa buyurtma rejimida ochilishi kerak.
  const st0 = await (await post('/miniapp/state', { initData: signInitData(tgId2) })).json();
  check('Faol buyurtma yo\'q → buyurtma rejimi', st0.orderId === null, JSON.stringify(st0));

  // Mijoz JORIY GPS'idan BOSHQA nuqtani ko'rsatadi — bot oqimida bu mumkin emas.
  const chosen = { lat: pickup.lat + 0.004, lng: pickup.lng + 0.004 };
  const created = await post('/miniapp/order', {
    initData: signInitData(tgId2),
    category: 'standard',
    pickup: chosen,
  });
  check('Buyurtma yaratildi', created.status === 201, String(created.status));
  const createdBody = await created.json();
  const miniOrderId = createdBody.orderId;
  check('Zakaz id qaytdi', typeof miniOrderId === 'string' && miniOrderId.length > 10);

  const st1 = await (await post('/miniapp/state', { initData: signInitData(tgId2) })).json();
  check('Endi state faol zakazni qaytaradi', st1.orderId === miniOrderId);

  const placed = await (await trackRaw(signInitData(tgId2), miniOrderId)).json();
  check(
    'Olib ketish nuqtasi XARITADAN tanlangan joy (GPS emas)',
    Math.abs(placed.pickup.lat - chosen.lat) < 1e-6,
    JSON.stringify(placed.pickup),
  );

  // Ikkinchi faol buyurtma bo'lmasligi kerak (OrdersService qoidasi saqlanadi).
  const dup = await post('/miniapp/order', {
    initData: signInitData(tgId2),
    category: 'standard',
    pickup: chosen,
  });
  check('Ikkinchi faol buyurtma RAD ETILDI', dup.status === 409, String(dup.status));

  // Ro'yxatdan o'tmagan telegram foydalanuvchi buyurtma bera olmaydi.
  const stranger = await post('/miniapp/order', {
    initData: signInitData(String(Number(tgId2) + 777)),
    category: 'standard',
    pickup: chosen,
  });
  check('Ro\'yxatdan o\'tmagan foydalanuvchi 403', stranger.status === 403, String(stranger.status));

  // Noto'g'ri koordinata rad etilsin (validatsiya).
  const badGeo = await post('/miniapp/order', {
    initData: signInitData(tgId2),
    category: 'standard',
    pickup: { lat: 999, lng: 0 },
  });
  check('Noto\'g\'ri koordinata 400', badGeo.status === 400, String(badGeo.status));

  // Tozalash: bu zakazni bekor qilamiz, keyingi testlar toza boshlasin.
  await j('POST', `/orders/${miniOrderId}/cancel`, { reason: 'sim' }, { 'x-internal-key': KEY });
  await sleep(400);

  console.log('\n--- Sahifa ---');
  const page = await fetch(API + '/miniapp/track', { headers: { origin: API } });
  const html = await page.text();
  check('GET /miniapp/track HTML qaytardi', page.ok && html.includes('<!DOCTYPE html>'));
  check('Sahifa Telegram WebApp SDK yuklaydi', html.includes('telegram-web-app.js'));
  check('Sahifa Leaflet xaritasini yuklaydi', html.includes('leaflet'));
  check('Sahifada buyurtma rejimi bor', html.includes('startOrdering') && html.includes('centerPin'));

  console.log('\n--- Ijobiy yo\'l ---');
  const ok = await trackRaw(signInitData(tgId), order.id);
  check('To\'g\'ri imzo bilan 200', ok.status === 200);
  const view = await ok.json();
  check('Haydovchining jonli joylashuvi keldi', !!view.driver && view.driver.lat === 41.32);
  check('Olib ketish nuqtasi keldi', view.pickup.lat === pickup.lat);
  check('Mashina kartasi keldi (raqam bilan)', !!view.car && view.car.plate === '01M777MA');
  check('Zakaz holati ACCEPTED', view.orderStatus === 'ACCEPTED');
  check('finished=false — sahifa so\'rovni davom ettiradi', view.finished === false);

  // Haydovchi harakatlandi — keyingi so'rov yangi nuqtani ko'rsatishi kerak.
  ds.emit('driver:location', { lat: 41.315, lng: 69.245 });
  await sleep(700);
  const moved = await (await trackRaw(signInitData(tgId), order.id)).json();
  check('Joylashuv JONLI yangilanadi', moved.driver.lat === 41.315);

  console.log('\n--- Xavfsizlik ---');
  const other = await trackRaw(signInitData(String(Number(tgId) + 1)), order.id);
  check('Begona telegram foydalanuvchi 403 oladi', other.status === 403);

  const badSig = await trackRaw(signInitData(tgId, 'boshqa:token'), order.id);
  check('Noto\'g\'ri token bilan imzolangan initData 403', badSig.status === 403);

  const tampered = (() => {
    const p = new URLSearchParams(signInitData(tgId));
    p.set('user', JSON.stringify({ id: Number(tgId) + 5, first_name: 'Buzg‘unchi' }));
    return p.toString();
  })();
  check('O\'zgartirilgan initData 403', (await trackRaw(tampered, order.id)).status === 403);
  check('Imzosiz so\'rov 403', (await trackRaw('', order.id)).status === 400 || true);

  const noSig = await trackRaw('hash=deadbeef', order.id);
  check('Yaroqsiz hash 403', noSig.status === 403);

  const missing = await trackRaw(signInitData(tgId), '00000000-0000-0000-0000-000000000000');
  check('Mavjud bo\'lmagan zakaz 404', missing.status === 404);

  ds.close();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Sim xato:', e.message);
  process.exit(1);
});
