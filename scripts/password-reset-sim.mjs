// Parolni tiklash (2026-09-14).
//
// MUAMMO: operator haydovchining parolini bilmaydi va tiklash yo'li yo'q edi.
// 2026-09-13 da Damasli haydovchi aynan shu sabab BLOKLANGAN edi (kira
// olmagani uchun), ya'ni butun Standart toifa bitta mashinasiz qolgan.
//
// Bu auth masalasi, shuning uchun sim ESKI parol ishlamay qolishini ham
// tekshiradi — aks holda tiklash xavfsizlik teshigi bo'lardi.
//
// Ishga tushirish: `node scripts/password-reset-sim.mjs`
import { adminLogin, jx, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};

async function login(phone, password) {
  const r = await fetch(API + '/auth/driver/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function main() {
  console.log(`\n=== Parol tiklash sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ADM = { authorization: 'Bearer ' + adminToken };
  const phone = simPhone();

  const created = await jx(API, 'POST', '/ops/drivers', {
    phone, firstName: 'Damas',
    vehicle: { category: 'standard', plate: simPlate(), model: 'Damas', seats: 7 },
  }, ADM);
  const oldPw = created.tempPassword;
  const driverId = created.driver.id;
  check('Haydovchi yaratildi va vaqtinchalik parol qaytdi', !!oldPw && !!driverId);

  const first = await login(phone, oldPw);
  check('Eski parol bilan kirish ishlaydi', first.status === 201, String(first.status));

  const reset = await fetch(API + `/ops/drivers/${driverId}/reset-password`, { method: 'POST', headers: ADM });
  const newPw = (await reset.json()).tempPassword;
  check('Tiklash yangi parol qaytardi', reset.status === 201 && !!newPw && newPw !== oldPw, `${reset.status}`);

  const stale = await login(phone, oldPw);
  check('ESKI parol endi ISHLAMAYDI (401)', stale.status === 401, String(stale.status));

  const fresh = await login(phone, newPw);
  check('Yangi parol bilan kirish ishlaydi', fresh.status === 201, String(fresh.status));
  check('Birinchi kirishda parol almashtirish talab qilinadi',
    fresh.body?.mustChangePassword === true, JSON.stringify(fresh.body?.mustChangePassword));

  const noAuth = await fetch(API + `/ops/drivers/${driverId}/reset-password`, { method: 'POST' });
  check('Tokensiz tiklab bo‘lmaydi (401)', noAuth.status === 401, String(noAuth.status));

  const asDriver = await fetch(API + `/ops/drivers/${driverId}/reset-password`, {
    method: 'POST', headers: { authorization: 'Bearer ' + fresh.body.token },
  });
  check('Haydovchi tokeni bilan tiklab bo‘lmaydi (403)', asDriver.status === 403, String(asDriver.status));

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SIM XATOSI:', e); process.exit(1); });
