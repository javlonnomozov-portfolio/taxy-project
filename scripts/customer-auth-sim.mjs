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
import { adminLogin, jx, simPhone } from './helpers.mjs';

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

  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
