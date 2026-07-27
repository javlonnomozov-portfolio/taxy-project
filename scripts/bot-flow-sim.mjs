// Bot oqimini token'siz tekshirish: botning haqiqiy kodi (createBot) soxta Telegram
// update'lari bilan haydaladi; telegram.sendMessage stub qilinadi va xabarlar yig'iladi.
// Haydovchi socket orqali simulyatsiya qilinadi (offerni qabul qiladi, safarni yakunlaydi).
process.env.BOT_TOKEN = 'test:token';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';

const API = process.env.API_BASE_URL;
const KEY = process.env.INTERNAL_API_KEY;
const pickup = { lat: 41.311, lng: 69.24 };

let passed = 0, failed = 0;
const check = (n, c, e = '') => { if (c) (passed++, console.log(`  ✅ ${n}`)); else (failed++, console.log(`  ❌ ${n} ${e}`)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, step = 50) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(step); } return false; }

async function j(m, p, b, h = {}) { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${t}`); return t ? JSON.parse(t) : {}; }

const { createBot } = await import('../apps/bot/dist/bot.js');
const { io } = await import('socket.io-client');
const { adminLogin, createDriver } = await import('./helpers.mjs');

// --- Soxta Telegram ---
const sent = []; // {chatId, text}
const bot = createBot();
bot.botInfo = { id: 1, is_bot: true, first_name: 'TTY', username: 'tty_bot' };
// Barcha Telegram API chaqiruvlari callApi orqali o'tadi — prototipda stub qilamiz (tarmoqsiz).
let mid = 0;
Object.getPrototypeOf(bot.telegram).callApi = async function (method, payload = {}) {
  if (method === 'sendMessage') {
    sent.push({ chatId: payload.chat_id, text: payload.text });
    return { message_id: ++mid, chat: { id: payload.chat_id }, date: 0, text: payload.text };
  }
  return true;
};
const lastText = () => sent.length ? sent[sent.length - 1].text : '';
const anyText = (sub) => sent.some((m) => m.text.includes(sub));

const CHAT = 555;
const USER = { id: 555, is_bot: false, first_name: 'Test' };
let uid = 1;
const feedMsg = (fields) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: CHAT, type: 'private' }, from: USER, ...fields } });
const feedText = (text) => feedMsg({ text });
const feedCmd = (text) => feedMsg({ text, entities: [{ type: 'bot_command', offset: 0, length: text.length }] });
const feedCb = (data) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: USER, chat_instance: '1', data, message: { message_id: 1, date: 0, chat: { id: CHAT, type: 'private' }, from: USER } } });

// --- Simulyatsiya haydovchisi ---
async function startDriver() {
  const phone = '+99890' + Math.floor(1000000 + Math.random() * 8999999);
  const adminToken = await adminLogin(API);
  const v = await createDriver(API, adminToken, {
    phone,
    firstName: 'Jasur',
    vehicle: { category: 'standard', plate: '01BOT', make: 'Chevrolet', model: 'Cobalt', color: 'oq' },
  });
  const s = io(API + '/driver', { auth: { token: v.token }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  await new Promise((r) => s.emit('driver:online', {}, r));
  s.emit('driver:location', { lat: pickup.lat, lng: pickup.lng });
  // Offer kelsa avtomatik qabul qilib, safarni yakunlash
  s.on('order:offer', async (o) => {
    s.emit('driver:offer_response', { orderId: o.orderId, accept: true });
    await sleep(300);
    await new Promise((r) => s.emit('trip:arrived', { orderId: o.orderId }, r));
    await new Promise((r) => s.emit('trip:start', { orderId: o.orderId }, r));
    await new Promise((r) => s.emit('trip:complete', { orderId: o.orderId, distanceM: 3000 }, r));
  });
  return s;
}

async function main() {
  console.log(`\n=== TTY Bot oqimi simulyatsiyasi (${API}) ===\n`);
  const driver = await startDriver();
  await sleep(500);

  console.log('--- Ro\'yxatdan o\'tish ---');
  await feedCmd('/start');
  await feedCb('lang:uz');
  check('Til tanlagach telefon so\'raldi', anyText('telefon'));
  await feedMsg({ contact: { phone_number: '+998901234599', user_id: USER.id, first_name: 'Test' } });
  check('Telefon ulashgach ro\'yxatdan o\'tdi', anyText('taksi chaqirishingiz mumkin') || anyText('Tayyor'));

  console.log('\n--- Taksi chaqirish oqimi ---');
  await feedText('🚕 Taksi chaqirish');
  check('Toifa so\'raldi', anyText('toifasini'));
  await feedCb('cat:standard');
  check('Lokatsiya so\'raldi', anyText('Olib ketish'));
  await feedMsg({ location: { latitude: pickup.lat, longitude: pickup.lng } });
  check('Manzil so\'raldi', anyText('manzilini'));
  await feedText('Registon ko‘chasi 12'); // manzilni yozamiz (skip emas)
  check('Izoh so\'raldi', anyText('Izoh'));
  await feedText('⏭ O‘tkazib yuborish'); // izohni o'tkazib yuboramiz
  check('Tasdiq so\'raldi', anyText('Tasdiqlaysizmi'));

  const before = sent.length;
  await feedCb('order:confirm');
  check('Buyurtma berilgach "izlanmoqda" xabari', await waitFor(() => sent.slice(before).some((m) => m.text.includes('izlanmoqda'))));

  // Haydovchi avtomatik qabul qiladi → tracker "Haydovchi topildi"
  check('Haydovchi topildi xabari keldi (jonli status)', await waitFor(() => anyText('Haydovchi topildi')));
  check('Safar yakunlandi + narx xabari', await waitFor(() => anyText('Safar yakunlandi'), 5000));

  console.log('\n--- Baholash ---');
  await feedCb('rate:5');
  check('Baho uchun rahmat xabari', await waitFor(() => anyText('rahmat')));

  console.log(`\n=== Natija: ${passed} ✅ / ${failed} ❌ ===\n`);
  driver.close();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('SIM XATO:', e); process.exit(1); });
