// Mini app ↔ bot sinxronligi.
//
// Mijoz mini app'da zakaz berganda bot bu haqda BILMASDI: Telegram'ga na
// "haydovchi topildi", na bekor qilish tugmasi kelardi. Endi API Redis pub/sub
// orqali xabar beradi, bot esa kuzatishni boshlaydi.
//
// Bu sim API tomonini tekshiradi: mini app'dan zakaz berilganda `bot:track`
// kanaliga to'g'ri xabar chiqadimi.
//
// Ishga tushirish: `TELEGRAM_BOT_TOKEN=123:TEST node scripts/miniapp-bot-sync-sim.mjs`
import { createHmac } from 'node:crypto';
import Redis from 'ioredis';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123:TEST';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
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

function signInitData(telegramId) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH' + Math.floor(Math.random() * 1e6),
    user: JSON.stringify({ id: Number(telegramId), first_name: 'Mijoz' }),
  };
  const dataCheck = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const p = new URLSearchParams(fields);
  p.set('hash', createHmac('sha256', secret).update(dataCheck).digest('hex'));
  return p.toString();
}

async function main() {
  console.log(`\n=== Mini app → bot sinxronligi (API: ${API}) ===\n`);

  // Bot o'rniga biz kanalga obuna bo'lamiz.
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const events = [];
  await new Promise((res, rej) =>
    sub.subscribe('bot:track', (e) => (e ? rej(e) : res())),
  );
  sub.on('message', (_c, raw) => {
    try { events.push(JSON.parse(raw)); } catch { /* ignore */ }
  });

  const tgId = String(730000000 + Math.floor(Math.random() * 1e6));
  await j(
    'POST',
    '/customers/upsert',
    { telegramId: tgId, phone: '+99890' + Math.floor(1000000 + Math.random() * 8999999), firstName: 'Sync' },
    { 'x-internal-key': KEY },
  );

  const created = await fetch(API + '/miniapp/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: API },
    body: JSON.stringify({ initData: signInitData(tgId), category: 'standard', pickup }),
  });
  check('Mini app buyurtmasi yaratildi', created.status === 201, String(created.status));
  const { orderId } = await created.json();

  await sleep(800);
  const ev = events.find((e) => e.orderId === orderId);
  check('Bot kanaliga xabar chiqdi', !!ev, JSON.stringify(events));
  check('Xabarda telegram id bor (bot chatni topa olsin)', !!ev && ev.telegramId === tgId, ev && ev.telegramId);

  // Bot oqimidan berilgan zakaz kanalga CHIQMASLIGI kerak — botning o'zi
  // allaqachon kuzatadi, ikki marta kuzatish ikki xabar bo'lardi.
  // ALOHIDA mijoz: yuqoridagi zakaz NO_DRIVER'da bo'lishi mumkin va uni bekor
  // qilib bo'lmaydi — shu bilan aralashib ketmasin.
  const before = events.length;
  const c2 = await j(
    'POST',
    '/customers/upsert',
    { telegramId: String(Number(tgId) + 1), phone: '+99891' + Math.floor(1000000 + Math.random() * 8999999), firstName: 'Bot' },
    { 'x-internal-key': KEY },
  );
  const viaBot = await j(
    'POST',
    '/orders',
    { customerId: c2.id, category: 'standard', pickup },
    { 'x-internal-key': KEY },
  );
  await sleep(800);
  check(
    'Bot oqimidagi zakaz kanalga CHIQMAYDI (ikki marta kuzatilmasin)',
    !events.slice(before).some((e) => e.orderId === viaBot.id),
  );

  sub.disconnect();
  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
