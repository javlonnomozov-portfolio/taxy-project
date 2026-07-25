import { config as loadEnv } from 'dotenv';

loadEnv();

export const CONFIG = {
  botToken: process.env.BOT_TOKEN ?? '',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  internalKey: process.env.INTERNAL_API_KEY ?? 'dev_internal_key',
};

export const hasToken = !!CONFIG.botToken && CONFIG.botToken !== 'your_telegram_bot_token';
