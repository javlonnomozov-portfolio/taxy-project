#!/usr/bin/env node
/**
 * Mobil ilova versiyasini oshiradi.
 *
 *   node scripts/bump-mobile.mjs mijoz              # faqat versionCode +1
 *   node scripts/bump-mobile.mjs haydovchi --patch  # 1.0.0 -> 1.0.1 ham
 *   node scripts/bump-mobile.mjs mijoz --minor
 *
 * NEGA KERAK: `app.json` da `versionCode` umuman yo'q edi, ya'ni Expo uni
 * HAR build'da 1 qilib qo'yardi. Oqibatlari:
 *
 *  - Telefondagi ilova qaysi build ekanini aytib bo'lmasdi ("eskisi
 *    qolganmi yoki yangisi o'rnatilganmi?" — sinovda chalkashlik).
 *  - Android yangilanishni versionCode bo'yicha hal qiladi; teng bo'lsa uni
 *    yangilanish deb hisoblamaydi.
 *  - Play Market bir xil versionCode'li ikkinchi APK'ni RAD ETADI.
 *
 * `version` (1.0.0) — odamlar uchun, `versionCode` — Android uchun. Ikkinchisi
 * HECH QACHON kamaymasligi kerak, shuning uchun skript faqat oshiradi.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APPS = {
  mijoz: 'apps/customer-app/app.json',
  haydovchi: 'apps/driver-app/app.json',
};

const argv = process.argv.slice(2);
const which = argv.find((a) => !a.startsWith('--'));
const path = APPS[which];

if (!path) {
  console.error(`Foydalanish: node scripts/bump-mobile.mjs <${Object.keys(APPS).join('|')}> [--patch|--minor|--major]`);
  process.exit(1);
}

const raw = readFileSync(path, 'utf8');
const cfg = JSON.parse(raw);
const expo = cfg.expo;

// --- versionCode: har doim +1 --------------------------------------------
const before = expo.android.versionCode ?? 1;
expo.android.versionCode = before + 1;

// --- version (semver): faqat so'ralganda -----------------------------------
let versionNote = expo.version;
const step = ['major', 'minor', 'patch'].find((s) => argv.includes('--' + s));
if (step) {
  const parts = String(expo.version).split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  const i = { major: 0, minor: 1, patch: 2 }[step];
  parts[i] += 1;
  for (let k = i + 1; k < 3; k++) parts[k] = 0;
  expo.version = parts.join('.');
  versionNote = `${cfg.expo.version} (${step})`;
}

// iOS'da mos maydon `buildNumber` — hozir ishlatilmaydi, lekin bor bo'lsa
// ikkisi ajralib ketmasin.
if (expo.ios && expo.ios.buildNumber !== undefined) {
  expo.ios.buildNumber = String(expo.android.versionCode);
}

// Oxirgi yangi qator saqlanadi (prettier/git diff toza qolsin).
writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

console.log(`${path}`);
console.log(`  versionCode : ${before} -> ${expo.android.versionCode}`);
console.log(`  version     : ${versionNote}`);
console.log(`\nKeyingi qadam: expo prebuild + gradlew assembleRelease (docs/HANDOFF.md 6.1)`);
