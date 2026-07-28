// Manzil qidirish YOQILGAN holatda bot oqimi: variant tanlash, "topilmadi",
// matnni qoldirish. API `NOMINATIM_URL` bilan ishga tushirilgan bo'lishi kerak.
process.env.BOT_TOKEN = 'test:token';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';

const { createBot } = await import('../apps/bot/dist/bot.js');
const { MemorySessionStore } = await import('../apps/bot/dist/session.js');

let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${x}`)); };

const sent = [];
const bot = createBot(new MemorySessionStore());
bot.botInfo = { id: 1, is_bot: true, first_name: 'TTY', username: 'tty_bot' };
let mid = 0;
Object.getPrototypeOf(bot.telegram).callApi = async function (method, payload = {}) {
  if (method === 'sendMessage') {
    sent.push({ text: payload.text, kb: payload.reply_markup });
    return { message_id: ++mid, chat: { id: payload.chat_id }, date: 0, text: payload.text };
  }
  return true;
};

const CHAT = 991;
const USER = { id: 991, is_bot: false, first_name: 'Geo' };
let uid = 1;
const feedMsg = (f) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: { id: CHAT, type: 'private' }, from: USER, ...f } });
const feedText = (text) => feedMsg({ text });
const feedCmd = (text) => feedMsg({ text, entities: [{ type: 'bot_command', offset: 0, length: text.length }] });
const feedCb = (data) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: USER, chat_instance: '1', data, message: { message_id: 1, date: 0, chat: { id: CHAT, type: 'private' }, from: USER } } });
const anyText = (s) => sent.some((m) => m.text?.includes(s));
const btns = () => (sent[sent.length - 1]?.kb?.inline_keyboard || []).flat().map((b) => b.callback_data);

console.log(`\n=== Manzil qidirish oqimi (${process.env.API_BASE_URL}) ===\n`);

await feedCmd('/start');
await feedCb('lang:uz');
await feedMsg({ contact: { phone_number: '+998901112233', user_id: USER.id, first_name: 'Geo' } });

async function toDestStep() {
  await feedText('🚕 Taksi chaqirish');
  await feedCb('cat:standard');
  await feedMsg({ location: { latitude: 39.7683, longitude: 67.2792 } });
}
await toDestStep();
check('Manzil qadamiga yetdi', anyText('manzilini'));

console.log('\n--- Topilgan manzil → variantlar ---');
sent.length = 0;
await feedText('Registon');
check('Variant tanlash so\'raldi', anyText('Qaysi manzilni'), `(${sent.map(s=>s.text).join(' | ').slice(0,70)})`);
check('Har variant uchun tugma', btns().filter((d) => d?.startsWith('dest:pick:')).length === 2);
check('"Yozganimni qoldirish" tugmasi', btns().includes('dest:keep'));

console.log('\n--- Variant tanlangach ---');
sent.length = 0;
await feedCb('dest:pick:0');
check('Tanlangan manzil tasdiqlandi', anyText('Registon maydoni'));
check('Izoh qadamiga o\'tdi', anyText('Izoh'));

console.log('\n--- Topilmagan manzil ---');
await feedCb('order:abort');
await toDestStep();
sent.length = 0;
await feedText('zzzqqq');
check('Mijozga "topilmadi" deb aytildi', anyText('topilmadi'), `(${sent.map(s=>s.text).join(' | ').slice(0,70)})`);
check('Qayta yozish tugmasi', btns().includes('dest:retry'));
check('Matnni qoldirish tugmasi', btns().includes('dest:keep'));

console.log('\n--- Matnni qoldirish ---');
sent.length = 0;
await feedCb('dest:keep');
check('Matn saqlangani aytildi', anyText('matn sifatida'));
check('Izoh qadamiga o\'tdi', anyText('Izoh'));

console.log(`\n=== Natija: ${pass} ✅ / ${fail} ❌ ===\n`);
process.exit(fail ? 1 : 0);
