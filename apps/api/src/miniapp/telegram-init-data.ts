import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramUser {
  id: string; // bigint — string sifatida (customers.telegram_id ham bigint)
  firstName?: string;
  languageCode?: string;
}

/**
 * Telegram Mini App `initData` imzosini tekshiradi.
 *
 * Sahifa Telegram ichida ochilganda `window.Telegram.WebApp.initData` beriladi —
 * bu bot tokeni bilan imzolangan query-string. Tekshirmasdan ishonib bo'lmaydi:
 * aks holda istalgan odam `?order=<id>` bilan kirib begona safarni kuzatardi.
 *
 * Telegram algoritmi:
 *   secret       = HMAC_SHA256(key: "WebAppData", msg: bot_token)
 *   data_check   = kalitlar alifbo tartibida, "k=v" qatorlari \n bilan (hash'siz)
 *   kutilgan hash = HMAC_SHA256(key: secret, msg: data_check)
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 24 * 3600,
): TelegramUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  // Doimiy vaqtli solishtirish — hash'ni bayt-bayt topishga yo'l qo'ymaslik uchun.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Eski initData qayta ishlatilmasin (masalan skrinshotdan olingan havola).
  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as {
      id?: number;
      first_name?: string;
      language_code?: string;
    } | null;
    if (!user?.id) return null;
    return {
      id: String(user.id),
      firstName: user.first_name,
      languageCode: user.language_code,
    };
  } catch {
    return null;
  }
}
