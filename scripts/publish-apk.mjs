#!/usr/bin/env node
/**
 * APK'ni GitHub Release'ga chiqaradi — O'ZGARMAS havola bilan.
 *
 *   node scripts/publish-apk.mjs <apk> [--tag mijoz-latest] [--name toy-taxy-mijoz.apk]
 *
 * NEGA QO'ZG'ALUVCHI TEG: foydalanuvchi har build'da yangi havola olishni
 * xohlamaydi. `mijoz-latest` tegi har safar yangi commit'ga ko'chiriladi va
 * fayl nomi o'zgarmaydi, ya'ni bu havola DOIM eng so'nggi APK'ni beradi:
 *
 *   https://github.com/<repo>/releases/download/mijoz-latest/toy-taxy-mijoz.apk
 *
 * PRERELEASE bo'lib qoladi (`make_latest: false`) — aks holda GitHub'ning
 * `releases/latest` havolasi shu relizga ko'chib, undagi
 * `toy-taxy-haydovchi.apk` yo'qolar va haydovchi ilovasining havolasi
 * 404 bo'lardi.
 *
 * `gh` CLI KERAK EMAS (bu mashinada o'rnatilmagan): token Git Credential
 * Manager'dan olinadi — xuddi `git push` qanday autentifikatsiya qilsa,
 * shunday. Token hech qayerga yozilmaydi va chop etilmaydi.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const REPO = 'javlonnomozov-portfolio/taxy-project';
const API = 'https://api.github.com';

// ---------------------------------------------------------------- argumentlar
const argv = process.argv.slice(2);
const apkPath = argv.find((a) => !a.startsWith('--'));
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const tag = flag('tag', 'mijoz-latest');
const assetName = flag('name', 'toy-taxy-mijoz.apk');

if (!apkPath) {
  console.error('Foydalanish: node scripts/publish-apk.mjs <apk> [--tag T] [--name F.apk]');
  process.exit(1);
}
statSync(apkPath); // yo'q bo'lsa shu yerda yiqiladi

const sha = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const shortSha = sha.slice(0, 7);

// ---------------------------------------------------------------------- token
function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' },
  }).toString();
  const m = out.match(/^password=(.*)$/m);
  if (!m) throw new Error('GitHub tokeni topilmadi (Credential Manager bo\'sh).');
  return m[1];
}
const TOK = token();
const H = { Authorization: `Bearer ${TOK}`, Accept: 'application/vnd.github+json' };

async function gh(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...H, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json.message ?? text}`);
  return json;
}

// ------------------------------------------------------------------- jarayon
const notes = [
  `Eng so'nggi mijoz ilovasi. Bu havola O'ZGARMAYDI — har build'da fayl yangilanadi.`,
  ``,
  `**Yuklab olish:** \`${assetName}\``,
  `**Kod:** \`${shortSha}\``,
  ``,
  `Sinov build'i: debug kaliti bilan imzolangan, Play Market uchun emas.`,
  `Oldingi lokal build ustiga o'rnatiladi — o'chirish shart emas.`,
].join('\n');

let release;
try {
  release = await gh('GET', `/repos/${REPO}/releases/tags/${tag}`);
  console.log(`mavjud reliz topildi (id ${release.id}) — yangilanadi`);

  // Tegni yangi commit'ga ko'chiramiz (reliz `target_commitish` ni O'ZI ko'chirmaydi).
  await gh('PATCH', `/repos/${REPO}/git/refs/tags/${tag}`, { sha, force: true });
  release = await gh('PATCH', `/repos/${REPO}/releases/${release.id}`, {
    name: `Toy TaxY mijoz — eng so'nggi (${shortSha})`,
    body: notes,
    prerelease: true,
    make_latest: 'false',
  });

  const old = (release.assets ?? []).find((a) => a.name === assetName);
  if (old) {
    await gh('DELETE', `/repos/${REPO}/releases/assets/${old.id}`);
    console.log(`eski fayl o'chirildi (${old.size} bayt)`);
  }
} catch (e) {
  if (!String(e.message).includes('-> 404')) throw e;
  console.log(`"${tag}" tegi yo'q — yangi reliz yaratiladi`);
  release = await gh('POST', `/repos/${REPO}/releases`, {
    tag_name: tag,
    target_commitish: sha,
    name: `Toy TaxY mijoz — eng so'nggi (${shortSha})`,
    body: notes,
    draft: false,
    prerelease: true,
    make_latest: 'false',
  });
}

const bytes = readFileSync(apkPath);
const up = await fetch(
  `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`,
  {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/vnd.android.package-archive' },
    body: bytes,
  },
);
const upJson = JSON.parse(await up.text());
if (!up.ok) throw new Error(`yuklash ${up.status}: ${upJson.message}`);

console.log(`yuklandi: ${upJson.name} — ${upJson.size} bayt (${basename(apkPath)})`);
console.log(`\nO'ZGARMAS HAVOLA:\n${upJson.browser_download_url}`);
console.log(`reliz sahifasi: ${release.html_url}`);
