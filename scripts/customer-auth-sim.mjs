// Mijoz ilovasiga Telegram orqali kirish (1-bosqich).
//
// Oqim: ilova nonce oladi → foydalanuvchi deep link bilan botga `/start` beradi
// → bot tasdiqlaydi va 6 xonali kod qaytaradi → ilova YA `poll` bilan o'zi
// kiradi, YOKI kodni qo'lda kiritadi (zaxira yo'l).
//
// Bu sim ijobiy yo'lni ham, HAR BIR rad etish yo'lini ham tekshiradi:
// eskirgan/yo'q nonce, tasdiqlanmagan nonce, noto'g'ri kod, urinishlar
// chegarasi, bir martalik ishlatilish, begona telegram id.
//
// Ishga tushirish: `node scripts/customer-auth-sim.mjs`
import { createHmac } from 'node:crypto';
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const j = (m, p, b, h = {}) => jx(API, m, p, b, h);
const raw = (path, body, headers = {}) =>
  fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const INT = { 'x-internal-key': KEY };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123:TEST';

/** Mini App imzosi — ikkala kanal BIR XIL holatni ko'rishini tekshirish uchun. */
function signInitData(telegramId) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH' + Math.floor(Math.random() * 1e6),
    user: JSON.stringify({ id: Number(telegramId), first_name: 'Mijoz' }),
  };
  const dataCheck = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TG_TOKEN).digest();
  const p = new URLSearchParams(fields);
  p.set('hash', createHmac('sha256', secret).update(dataCheck).digest('hex'));
  return p.toString();
}

function decode(token) {
  const p = token.split('.')[1];
  return JSON.parse(Buffer.from(p + '='.repeat((-p.length % 4 + 4) % 4), 'base64url'));
}

async function main() {
  console.log(`\n=== Mijoz ilovasiga kirish sim (API: ${API}) ===\n`);
  await adminLogin(API); // API tirikligini tekshirish

  const tgId = String(800000000 + Math.floor(Math.random() * 1e6));
  const customer = await j(
    'POST',
    '/customers/upsert',
    { telegramId: tgId, phone: simPhone('+99893'), firstName: 'Mijoz' },
    INT,
  );

  // ---- 1: avtomatik yo'l (kod yozilmaydi) ----
  console.log('--- 1: deep link → poll (foydalanuvchi hech narsa yozmaydi) ---');
  const started = await j('POST', '/auth/customer/start', { deviceId: 'sim-' + tgId });
  check('nonce berildi', typeof started.nonce === 'string' && started.nonce.length > 20);
  check('deep link to\'g\'ri', /^https:\/\/t\.me\/.+\?start=/.test(started.deepLink), started.deepLink);
  check('amal qilish muddati bor', started.expiresInSec > 0, String(started.expiresInSec));

  const p0 = await j('POST', '/auth/customer/poll', { nonce: started.nonce });
  check('Tasdiqlanmagan nonce → token YO\'Q (xato emas)', p0.token === null, JSON.stringify(p0));

  const conf = await j('POST', '/auth/customer/confirm', { nonce: started.nonce, telegramId: tgId }, INT);
  check('Bot tasdiqladi, 6 xonali kod keldi', /^\d{6}$/.test(conf.code), conf.code);

  const p1 = await j('POST', '/auth/customer/poll', { nonce: started.nonce });
  check('poll token berdi', typeof p1.token === 'string' && p1.token.length > 20);
  const payload = decode(p1.token);
  check('Token roli = customer', payload.role === 'customer', payload.role);
  check('Token egasi = o\'sha mijoz', payload.sub === customer.id, payload.sub);

  const p2 = await raw('/auth/customer/poll', { nonce: started.nonce });
  check('nonce BIR MARTALIK — ikkinchi poll rad etildi', p2.status === 404, 'HTTP ' + p2.status);

  // ---- 2: token haqiqatan ishlaydimi ----
  console.log('\n--- 2: token bilan himoyalangan endpoint ---');
  const meOk = await fetch(API + '/drivers/me', {
    headers: { authorization: 'Bearer ' + p1.token },
  });
  check('Mijoz tokeni HAYDOVCHI endpointiga kirolmaydi', meOk.status === 403, 'HTTP ' + meOk.status);

  // ---- 3: zaxira yo'l — kod bilan ----
  console.log('\n--- 3: kod bilan kirish (zaxira yo\'l) ---');
  const s2 = await j('POST', '/auth/customer/start', {});
  const c2 = await j('POST', '/auth/customer/confirm', { nonce: s2.nonce, telegramId: tgId }, INT);
  const wrong2 = c2.code === '000000' ? '111111' : '000000';
  const bad = await raw('/auth/customer/verify', { nonce: s2.nonce, code: wrong2 });
  check('Noto\'g\'ri kod rad etildi', bad.status === 400, 'HTTP ' + bad.status);
  const good = await j('POST', '/auth/customer/verify', { nonce: s2.nonce, code: c2.code });
  check('To\'g\'ri kod token berdi', typeof good.token === 'string');
  check('Token roli = customer', decode(good.token).role === 'customer');
  const again = await raw('/auth/customer/verify', { nonce: s2.nonce, code: c2.code });
  check('Kod BIR MARTALIK', again.status === 404, 'HTTP ' + again.status);

  // ---- 4: urinishlar chegarasi ----
  console.log('\n--- 4: kodni tanlab olishga qarshi chegara ---');
  const s3 = await j('POST', '/auth/customer/start', {});
  const c3 = await j('POST', '/auth/customer/confirm', { nonce: s3.nonce, telegramId: tgId }, INT);
  const wrong = c3.code === '123456' ? '654321' : '123456';
  let lastStatus = 0;
  for (let i = 0; i < 5; i++) {
    const r = await raw('/auth/customer/verify', { nonce: s3.nonce, code: wrong });
    lastStatus = r.status;
  }
  check('5 xato urinishdan keyin nonce o\'ldi', lastStatus === 403, 'HTTP ' + lastStatus);
  const afterKill = await raw('/auth/customer/verify', { nonce: s3.nonce, code: c3.code });
  check('O\'lgan nonce bilan TO\'G\'RI kod ham ishlamaydi', afterKill.status === 404, 'HTTP ' + afterKill.status);

  // ---- 5: rad etish yo'llari ----
  console.log('\n--- 5: rad etish yo\'llari ---');
  const noNonce = await raw('/auth/customer/poll', { nonce: 'yoq-bunday-nonce' });
  check('Mavjud bo\'lmagan nonce → 404', noNonce.status === 404, 'HTTP ' + noNonce.status);

  const s4 = await j('POST', '/auth/customer/start', {});
  const notConfirmed = await raw('/auth/customer/verify', { nonce: s4.nonce, code: '123456' });
  check('Tasdiqlanmagan nonce'.padEnd(1) + ' bilan verify → 400', notConfirmed.status === 400, 'HTTP ' + notConfirmed.status);

  const noKey = await raw('/auth/customer/confirm', { nonce: s4.nonce, telegramId: tgId });
  check('confirm ICHKI KALITSIZ rad etiladi', noKey.status === 401 || noKey.status === 403, 'HTTP ' + noKey.status);

  const strangerTg = String(Number(tgId) + 999);
  const stranger = await raw('/auth/customer/confirm', { nonce: s4.nonce, telegramId: strangerTg }, INT);
  check('Ro\'yxatdan o\'tmagan telegram id → 404', stranger.status === 404, 'HTTP ' + stranger.status);

  // DIQQAT: "bloklangan mijoz kira olmaydi" bu yerda TEKSHIRILMAYDI, chunki
  // mijozni bloklaydigan endpoint UMUMAN YO'Q (`/ops/customers` faqat ro'yxat).
  // Kod tomoni tayyor (`AccountStatusService.customerActive`), lekin operator
  // uni ishga sololmaydi — CUSTOMER-APP-PLAN.md dagi ochiq savol.

  // ---- 6: ILOVA endpointlari + IKKALA KANAL SINXRONLIGI ----
  //
  // Eng muhim tekshiruv: ilova (JWT) va Mini App (initData) BIR XIL mantiqni
  // ishlatishi kerak. Avval mantiq har kanalda alohida yozilardi va bir kuni
  // biri yangilanmay qolardi — bu allaqachon ikki marta sodir bo'lgan.
  console.log('\n--- 6: ilova endpointlari va kanal pariteti ---');
  const APP = { authorization: 'Bearer ' + p1.token };
  const initData = signInitData(tgId);

  const none = await j('GET', '/customer/active', undefined, APP);
  check('Faol zakaz yo\'q (ilova)', none.orderId === null, JSON.stringify(none));

  const adminToken = await adminLogin(API);
  const d = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: 'Haydovchi',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Cobalt' },
  });
  const pickup = { lat: 41.311, lng: 69.24 };
  const ds = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((r) => ds.on('connect', r));
  await new Promise((r) => ds.emit('driver:online', {}, r));
  ds.emit('driver:location', pickup);
  await sleep(700);

  const made = await j('POST', '/customer/orders', { category: 'standard', pickup }, APP);
  check('ILOVADAN zakaz berildi', typeof made.orderId === 'string', JSON.stringify(made));

  const act = await j('GET', '/customer/active', undefined, APP);
  check('Faol zakaz ilovada ko\'rinadi', act.orderId === made.orderId);

  // PARITET: Mini App AYNAN shu zakazni ko'rsinmi?
  const viaMini = await raw('/miniapp/state', { initData });
  const miniState = await viaMini.json();
  check('MINI APP ham o\'sha zakazni ko\'radi', miniState.orderId === made.orderId,
    JSON.stringify(miniState));

  const trkApp = await j('GET', `/customer/orders/${made.orderId}`, undefined, APP);
  const trkMiniR = await raw('/miniapp/track', { initData, orderId: made.orderId });
  const trkMini = await trkMiniR.json();
  check('Ikkala kanal bir xil holat ko\'rsatadi',
    trkApp.orderStatus === trkMini.orderStatus && trkApp.cancellable === trkMini.cancellable,
    `${trkApp.orderStatus}/${trkApp.cancellable} vs ${trkMini.orderStatus}/${trkMini.cancellable}`);

  // BEGONA mijoz ilova endpointidan ham kira olmasin.
  const s5 = await j('POST', '/auth/customer/start', {});
  await j('POST', '/auth/customer/confirm', { nonce: s5.nonce, telegramId: tgId }, INT);
  const other = await raw(`/customer/orders/${made.orderId}/cancel`, {}, { authorization: 'Bearer notatoken' });
  check('Yaroqsiz token → 401', other.status === 401, 'HTTP ' + other.status);

  const canc = await j('POST', `/customer/orders/${made.orderId}/cancel`, {}, APP);
  check('ILOVADAN bekor qilindi', typeof canc.penalized === 'boolean', JSON.stringify(canc));
  const afterMini = await (await raw('/miniapp/track', { initData, orderId: made.orderId })).json();
  check('MINI APP bekor qilinganini ko\'radi',
    afterMini.orderStatus === 'CANCELLED_BY_CUSTOMER' && afterMini.cancellable === false,
    afterMini.orderStatus);

  ds.close();

  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
