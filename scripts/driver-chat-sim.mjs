// Haydovchi <-> panel chati (2026-09-13).
//
// Tekshiradi: matn ikki tomonga soket bilan yetadi, o'qilmaganlar hisobi,
// haydovchi oynasi (summary), rasm/ovoz yuklash va qaytarish, rasm deb
// yuborilgan SVG rad etilishi, boshqa haydovchining fayli ko'rinmasligi,
// huquqlar (haydovchi tokeni panel yo'liga 403), hajm (413) va tezlik (429).
//
// Ishga tushirish: `node scripts/driver-chat-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, token, body) {
  const headers = token ? { authorization: 'Bearer ' + token } : {};
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(API + path, { method, headers, body: payload });
  const type = r.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await r.json() : Buffer.from(await r.arrayBuffer());
  return { status: r.status, type, data };
}

const form = (bytes, kind, extra = {}) => {
  const f = new FormData();
  f.append('file', new Blob([bytes]), kind === 'image' ? 'rasm.png' : 'ovoz.m4a');
  f.append('kind', kind);
  for (const [k, v] of Object.entries(extra)) f.append(k, String(v));
  return f;
};

// 1x1 haqiqiy PNG va expo-av yozadigan m4a boshini taqlid qiluvchi bayt.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const M4A = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(200)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'.padEnd(80, ' '));

async function makeDriver(adminToken, label) {
  const d = await createDriver(API, adminToken, {
    phone: simPhone(), firstName: label,
    vehicle: { category: 'standard', plate: simPlate(), model: label, seats: 4 },
  });
  const s = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  const inbox = [];
  s.on('chat:message', (m) => inbox.push(m));
  return { ...d, socket: s, inbox };
}

async function main() {
  console.log(`\n=== Haydovchi chati sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ops = io(API + '/ops', { auth: { token: adminToken }, transports: ['websocket'] });
  await new Promise((r) => ops.on('connect', r));
  const opsInbox = [];
  ops.on('chat:message', (m) => opsInbox.push(m));

  const a = await makeDriver(adminToken, 'Chatli');
  const b = await makeDriver(adminToken, 'Begona');

  // ---- 1: haydovchi yozadi ----
  console.log('--- 1: haydovchi -> panel ---');
  const sent = await call('POST', '/chat/messages', a.token, { body: 'Salom, g‘ildirak teshildi' });
  check('Matn qabul qilindi', sent.status === 201, `${sent.status} ${JSON.stringify(sent.data)}`);
  await sleep(500);
  check('Panel soketi xabarni oldi', opsInbox.some((m) => m.id === sent.data.id));

  const conv = await call('GET', '/ops/chat/conversations', adminToken);
  const row = Array.isArray(conv.data) ? conv.data.find((c) => c.driverId === a.driverId) : null;
  check('Suhbatlar ro‘yxatida, o‘qilmagan = 1', row?.unread === 1, JSON.stringify(row));

  const sum = await call('GET', `/ops/chat/drivers/${a.driverId}/summary`, adminToken);
  check('Haydovchi oynasi: ism, mashina, reyting, bugungi ish',
    sum.status === 200 && sum.data.name === 'Chatli' && sum.data.vehicle?.plate &&
      typeof sum.data.ratingAvg === 'number' && typeof sum.data.tripsToday === 'number' && sum.data.unread === 1,
    JSON.stringify(sum.data).slice(0, 200));

  const read = await call('POST', `/ops/chat/drivers/${a.driverId}/read`, adminToken);
  const conv2 = await call('GET', '/ops/chat/conversations', adminToken);
  check('O‘qildi belgisi: o‘qilmagan = 0', read.data?.updated === 1 &&
    conv2.data.find((c) => c.driverId === a.driverId)?.unread === 0);

  // ---- 2: panel javob beradi ----
  console.log('\n--- 2: panel -> haydovchi ---');
  const reply = await call('POST', `/ops/chat/drivers/${a.driverId}/messages`, adminToken, { body: 'Hozir yordam yuboramiz' });
  await sleep(500);
  check('Javob haydovchi soketiga yetdi, muallif ko‘rinadi',
    a.inbox.some((m) => m.id === reply.data.id && m.authorLogin === 'admin'),
    JSON.stringify(a.inbox));
  check('Begona haydovchiga YETMADI', !b.inbox.some((m) => m.id === reply.data.id));
  check('Haydovchida o‘qilmagan = 1', (await call('GET', '/chat/unread', a.token)).data.unread === 1);
  await call('POST', '/chat/read', a.token);
  check('O‘qigach 0', (await call('GET', '/chat/unread', a.token)).data.unread === 0);

  const hist = await call('GET', '/chat/messages', a.token);
  check('Tarix eskidan yangiga', hist.data.length === 2 && hist.data[0].id === sent.data.id);

  // ---- 3: fayllar ----
  console.log('\n--- 3: rasm va ovoz ---');
  const img = await call('POST', '/chat/media', a.token, form(PNG, 'image'));
  check('Rasm yuklandi', img.status === 201 && img.data.kind === 'image' && img.data.mediaId, `${img.status} ${JSON.stringify(img.data)}`);
  const back = await call('GET', `/chat/media/${img.data.mediaId}`, a.token);
  check('Rasm aynan o‘sha baytlar va image/png bilan qaytdi',
    back.status === 200 && back.type.startsWith('image/png') && Buffer.compare(back.data, PNG) === 0,
    `${back.status} ${back.type}`);
  const viaOps = await call('GET', `/ops/chat/media/${img.data.mediaId}`, adminToken);
  check('Panel ham rasmni oladi', viaOps.status === 200);
  const stolen = await call('GET', `/chat/media/${img.data.mediaId}`, b.token);
  check('Begona haydovchi faylni OLOLMAYDI (404)', stolen.status === 404, String(stolen.status));

  const voice = await call('POST', '/chat/media', a.token, form(M4A, 'voice', { durationSec: 5 }));
  check('Ovozli xabar yuklandi (5 soniya)', voice.status === 201 && voice.data.durationSec === 5, `${voice.status} ${JSON.stringify(voice.data)}`);
  const tooLong = await call('POST', '/chat/media', a.token, form(M4A, 'voice', { durationSec: 500 }));
  check('500 soniyalik ovoz rad etildi (400)', tooLong.status === 400, String(tooLong.status));

  // ---- 4: himoya ----
  console.log('\n--- 4: himoya ---');
  const svg = await call('POST', '/chat/media', a.token, form(SVG, 'image'));
  check('Rasm deb yuborilgan SVG rad etildi (400)', svg.status === 400, `${svg.status} ${JSON.stringify(svg.data)}`);
  const mismatch = await call('POST', '/chat/media', a.token, form(M4A, 'image'));
  check('Ovoz faylini rasm deb yuborish rad etildi (400)', mismatch.status === 400);
  const big = await call('POST', '/chat/media', a.token, form(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), 'image'));
  check('2 MB dan katta fayl (413)', big.status === 413, String(big.status));
  const forbidden = await call('GET', '/ops/chat/conversations', a.token);
  check('Haydovchi tokeni panel yo‘liga kira olmaydi (403)', forbidden.status === 403, String(forbidden.status));
  const badId = await call('GET', '/ops/chat/drivers/not-a-uuid/summary', adminToken);
  check('Buzuq id — 400 (500 emas)', badId.status === 400, String(badId.status));
  const empty = await call('POST', '/chat/messages', a.token, { body: '   ' });
  check('Bo‘sh xabar rad etildi (400)', empty.status === 400, String(empty.status));

  // Tezlik chegarasi alohida haydovchida — boshqa tekshiruvlarga ta'sir qilmasin.
  const statuses = [];
  for (let i = 0; i < 24; i++) statuses.push((await call('POST', '/chat/messages', b.token, { body: 'spam ' + i })).status);
  check('Daqiqasiga 20 tadan keyin 429', statuses.slice(0, 20).every((s) => s === 201) && statuses.slice(20).includes(429),
    statuses.join(','));

  for (const s of [a.socket, b.socket, ops]) s.close();
  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('SIM XATOSI:', e);
  process.exit(1);
});
