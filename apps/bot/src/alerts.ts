import Redis from 'ioredis';
import type { Telegram } from 'telegraf';
import { CONFIG } from './config';

/** API `AllExceptionsFilter` shu kanalga yozadi (BOT_ALERT_CHANNEL bilan bir xil). */
const CHANNEL = 'bot:alert';

interface Alert {
  method?: string;
  path?: string;
  status?: number;
  error?: string;
  message?: string;
  frame?: string;
  requestId?: string;
  at?: string;
}

/** `2026-09-13T14:22:31.004Z` → `14:22:31` (UTC — Railway loglari ham UTC'da). */
function clock(iso?: string): string {
  const m = /T(\d{2}:\d{2}:\d{2})/.exec(iso ?? '');
  return m ? `${m[1]} UTC` : '';
}

function format(a: Alert): string {
  const lines = [
    `🔴 API ${a.status ?? 500}`,
    `${a.method ?? '?'} ${a.path ?? '?'}`,
    '',
    `${a.error ?? 'Error'}: ${a.message ?? '—'}`,
  ];
  if (a.frame) lines.push(a.frame);
  const tail = [a.requestId ? `req ${a.requestId}` : '', clock(a.at)].filter(Boolean).join(' · ');
  if (tail) lines.push('', tail);
  return lines.join('\n');
}

/**
 * Server xatolari haqida Telegram'ga ogohlantirish.
 *
 * NEGA: 5xx xatolar to'liq stack bilan loglanardi, lekin loglarga hech kim
 * qaramaydi — nosozlik haqida faqat mijoz qo'ng'iroq qilganda bilinardi.
 * Sentry o'rniga mavjud Redis pub/sub ishlatiladi: yangi bog'liqlik ham,
 * tashqi hisob ham kerak emas (API va bot allaqachon bitta Redis'ni bo'lishadi).
 *
 * `ADMIN_CHAT_ID` berilmagan bo'lsa — jim o'chadi. Shuning uchun lokal dev va
 * testlarda hech narsa o'zgarmaydi.
 *
 * Xabarni AYNAN shu yer formatlaydi: API tomondan faqat toza maydonlar keladi,
 * `parse_mode` ishlatilmaydi — xato matnidagi `<` yoki `*` xabarni buzmasin.
 */
export function listenAlerts(telegram: Telegram): void {
  if (!CONFIG.adminChatId) {
    console.log('[bot] ADMIN_CHAT_ID yo‘q — server xatolari haqida ogohlantirish o‘chiq');
    return;
  }
  if (!CONFIG.redisUrl) {
    console.warn('[bot] REDIS_URL yo‘q — server xatolari haqida ogohlantirish o‘chiq');
    return;
  }

  // Obuna rejimidagi ulanish boshqa buyruqlarni bajara olmaydi — alohida klient.
  const sub = new Redis(CONFIG.redisUrl, { maxRetriesPerRequest: null });

  sub.on('error', (e) => console.error('[bot] ogohlantirish kanali xatosi:', e.message));

  sub.subscribe(CHANNEL, (err) => {
    if (err) console.error('[bot] ogohlantirish kanaliga obuna bo‘lmadi:', err.message);
    else console.log('[bot] server xatolari kuzatilmoqda');
  });

  sub.on('message', (_channel, raw) => {
    let alert: Alert;
    try {
      alert = JSON.parse(raw);
    } catch {
      return;
    }
    // Xabar yuborilmasa ham obunachi tirik qolsin (masalan bot chatdan chiqarilgan).
    void telegram
      .sendMessage(CONFIG.adminChatId, format(alert), { disable_notification: false })
      .catch((e) =>
        console.error('[bot] ogohlantirish yuborilmadi:', (e as Error).message),
      );
  });
}
