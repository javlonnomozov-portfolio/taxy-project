import { CONFIG, hasToken } from './config';
import { createBot } from './bot';

// Mijoz Telegram boti — to'liq oqim (ro'yxatdan o'tish, taksi chaqirish, jonli status, baho).
// To'liq tasklar: docs/tasks/02-telegram-bot.md
async function main() {
  if (!hasToken) {
    console.warn('[bot] BOT_TOKEN sozlanmagan — bot ishga tushmadi (skelet rejimi).');
    console.warn('[bot] .env ga BOT_TOKEN qo‘shing va qayta ishga tushiring.');
    return;
  }
  const bot = createBot();
  // dropPendingUpdates: qayta ishga tushganda eski (backlog) update'lar qayta ishlanmaydi.
  await bot.launch({ dropPendingUpdates: true }, () =>
    console.log(`[bot] TTY bot ishga tushdi (API: ${CONFIG.apiBaseUrl})`),
  );

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((e) => {
  console.error('[bot] Xato:', e);
  process.exit(1);
});
