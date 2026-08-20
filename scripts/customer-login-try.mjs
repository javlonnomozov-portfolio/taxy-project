// Mijoz ilovasiga kirishni QO'LDA sinash — ilova hali yo'q bo'lganda.
//
// Skript ilovaning o'rnini bosadi: nonce oladi, havolani chiqaradi va
// tasdiqni kutadi. Siz faqat havolani Telegram'da ochasiz.
//
// Nonce 5 daqiqa yashaydi, shuning uchun skript uni MUDDATI TUGAGANDA
// AVTOMATIK yangilaydi va yangi havolani chiqaradi — shoshilish shart emas.
//
// Ishga tushirish:
//   node scripts/customer-login-try.mjs            (prod)
//   API_BASE_URL=http://localhost:3000 node scripts/customer-login-try.mjs
//
// Kod bilan sinash (zaxira yo'l): botdan kelgan kodni argument qilib bering
//   node scripts/customer-login-try.mjs 123456

const API = process.env.API_BASE_URL || 'https://api-production-13444.up.railway.app';
const manualCode = process.argv[2];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

function showToken(token) {
  const p = token.split('.')[1];
  const claims = JSON.parse(
    Buffer.from(p + '='.repeat((4 - (p.length % 4)) % 4), 'base64url').toString(),
  );
  console.log('\n✅ KIRISH MUVAFFAQIYATLI\n');
  console.log('   rol      :', claims.role);
  console.log('   mijoz id :', claims.sub);
  console.log('   muddat   :', Math.round((claims.exp - claims.iat) / 86400), 'kun');
  console.log('\n   (token ekranga chiqarilmadi — u haqiqiy kirish kaliti)\n');
}

async function newLink() {
  const { status, body } = await post('/auth/customer/start', { deviceId: 'qollanma-sinov' });
  if (status !== 200 && status !== 201) {
    console.error('start xato:', status, JSON.stringify(body));
    process.exit(1);
  }
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('  Telegram\'da SHU HAVOLANI oching va "Start" bosing:\n');
  console.log('  ' + body.deepLink);
  console.log('\n  (havola ' + Math.round(body.expiresInSec / 60) + ' daqiqa amal qiladi —');
  console.log('   eskirsa skript o\'zi yangisini chiqaradi)');
  console.log('────────────────────────────────────────────────────────────\n');
  return body.nonce;
}

async function main() {
  console.log(`\n=== Mijoz kirishini sinash (API: ${API}) ===`);
  let nonce = await newLink();

  // Kod qo'lda berilgan bo'lsa — zaxira yo'lni sinaymiz.
  if (manualCode) {
    console.log('Kod bilan sinash rejimi. Havolani ochib, kod kelishini kuting,');
    console.log('so\'ng skriptni O\'SHA kod bilan qayta ishga tushiring.\n');
  }

  process.stdout.write('Kutilmoqda');
  for (;;) {
    await sleep(3000);
    process.stdout.write('.');

    if (manualCode) {
      const r = await post('/auth/customer/verify', { nonce, code: manualCode });
      if (r.body?.token) return showToken(r.body.token);
      if (r.status === 404) nonce = (process.stdout.write('\n'), await newLink());
      continue;
    }

    const r = await post('/auth/customer/poll', { nonce });
    if (r.body?.token) return showToken(r.body.token);
    if (r.status === 404) {
      // Muddati tugadi — yangi havola chiqaramiz va kutishda davom etamiz.
      process.stdout.write('\n');
      nonce = await newLink();
      process.stdout.write('Kutilmoqda');
    }
  }
}

main().catch((e) => {
  console.error('\nXato:', e.message);
  process.exit(1);
});
