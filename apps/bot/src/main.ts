import { Telegraf } from 'telegraf';
import { CONFIG, hasToken } from './config';
import { createBot } from './bot';

// Mijoz Telegram boti — to'liq oqim (ro'yxatdan o'tish, taksi chaqirish, jonli status, baho).
// To'liq tasklar: docs/tasks/02-telegram-bot.md

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Telegram bir vaqtda faqat bitta `getUpdates` ga ruxsat beradi. */
const isConflict = (e: unknown): boolean =>
  (e as { response?: { error_code?: number } })?.response?.error_code === 409;

/**
 * Polling'ni 409 (Conflict) ga chidamli qilib ishga tushirish.
 *
 * NEGA KERAK: `bot.launch()` 50 soniyalik long-polling qiladi. Jarayon o'lganda
 * (deploy yoki crash) o'sha so'rov Telegram tomonida hali ochiq qolishi mumkin.
 * Yangi jarayon darhol polling boshlasa — 409 oladi. Avval bot shu yerda butunlay
 * yiqilardi, Railway uni qayta ishga tushirardi va yana 409 — ya'ni o'zini o'zi
 * qo'llab-quvvatlaydigan CRASH-LOOP hosil bo'lardi (aynan shu prod'da yuz berdi).
 *
 * Yechim: 409 da o'lmaymiz, eski so'rov muddati tugashini kutib qayta urinamiz.
 * Boshqa xatolarda esa darhol chiqamiz — ular haqiqiy nosozlik.
 */
async function launchWithRetry(bot: Telegraf): Promise<void> {
  const MAX_ATTEMPTS = 12;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // dropPendingUpdates: qayta ishga tushganda eski (backlog) update'lar qayta ishlanmaydi.
      await bot.launch({ dropPendingUpdates: true }, () =>
        console.log(`[bot] TTY bot ishga tushdi (API: ${CONFIG.apiBaseUrl})`),
      );
      return;
    } catch (e) {
      if (!isConflict(e)) throw e;
      // Long-polling oynasi 50s — shuncha kutish kifoya, lekin bosqichma-bosqich oshiramiz.
      const waitMs = Math.min(10_000 * attempt, 60_000);
      console.warn(
        `[bot] 409 Conflict (urinish ${attempt}/${MAX_ATTEMPTS}) — ` +
          `eski polling tugashini ${Math.round(waitMs / 1000)}s kutamiz`,
      );
      await sleep(waitMs);
    }
  }
  throw new Error('[bot] polling boshlanmadi: 409 Conflict bir necha urinishdan keyin ham davom etdi');
}

async function main() {
  if (!hasToken) {
    console.warn('[bot] BOT_TOKEN sozlanmagan — bot ishga tushmadi (skelet rejimi).');
    console.warn('[bot] .env ga BOT_TOKEN qo‘shing va qayta ishga tushiring.');
    return;
  }
  const bot = createBot();

  // Tartibli to'xtash — polling darhol yopiladi, keyingi instansiya 409 olmaydi.
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  await launchWithRetry(bot);
}

main().catch((e) => {
  console.error('[bot] Xato:', e);
  process.exit(1);
});
