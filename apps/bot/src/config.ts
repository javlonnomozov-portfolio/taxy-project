import { config as loadEnv } from 'dotenv';

loadEnv();

export const CONFIG = {
  botToken: process.env.BOT_TOKEN ?? '',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  internalKey: process.env.INTERNAL_API_KEY ?? 'dev_internal_key',
  // Sessiyalar Redis'da saqlanadi (bot qayta ishga tushganda yo'qolmasin).
  redisUrl: process.env.REDIS_URL,
  // "Taksi qayerda?" jonli xaritasi (Telegram Mini App). Odatda API'ning o'zi
  // beradi: <API_BASE_URL>/miniapp/track.
  miniappUrl: process.env.MINIAPP_URL || process.env.API_BASE_URL + '/miniapp/track',
  // Server xatolari (5xx) haqida ogohlantirish shu chatga boradi. Bo'sh
  // qoldirilsa ogohlantirish butunlay o'chiq — lokal dev'da shunday.
  adminChatId: process.env.ADMIN_CHAT_ID ?? '',
};

export const hasToken = !!CONFIG.botToken && CONFIG.botToken !== 'your_telegram_bot_token';

/**
 * Telegram `web_app` tugmasi FAQAT HTTPS havolani qabul qiladi — lokal dev'da
 * (http://localhost) bot butun klaviaturani rad etadi va mijoz hech qanday
 * tugma ko'rmaydi. Shuning uchun http bo'lsa eski statik joylashuv tugmasiga
 * qaytamiz.
 */
export const hasMiniapp = CONFIG.miniappUrl.startsWith('https://');
