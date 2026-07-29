import Redis from 'ioredis';
import { CONFIG } from './config';

/** API `MiniappService` shu kanalga yozadi (BOT_TRACK_CHANNEL bilan bir xil). */
const CHANNEL = 'bot:track';

/**
 * Mini app'dan berilgan buyurtmalarni tinglash.
 *
 * NEGA REDIS: mijoz mini app'da zakaz berganda bot bu haqda bilmasdi va
 * Telegram'ga hech narsa yubormasdi — na "haydovchi topildi", na bekor qilish
 * tugmasi. Mini app botga o'zi xabar bera olmaydi: `sendData()` faqat REPLY
 * klaviaturadan ochilgan mini app'da ishlaydi, u yerda esa `initData` yo'q
 * (ya'ni ikkalasini birga ishlatib bo'lmaydi).
 *
 * Bot va API allaqachon bitta Redis'ni bo'lishadi — yangi HTTP yuzasi ochish
 * va uni himoyalash shart emas.
 *
 * Obuna rejimidagi ulanish boshqa buyruqlarni bajara olmaydi, shuning uchun
 * sessiya uchun ishlatiladigan mijozdan ALOHIDA ulanish ochamiz.
 */
export function listenMiniappOrders(
  onOrder: (telegramId: string, orderId: string) => Promise<void>,
): void {
  if (!CONFIG.redisUrl) {
    console.warn('[bot] REDIS_URL yo‘q — mini app buyurtmalari kuzatilmaydi');
    return;
  }
  const sub = new Redis(CONFIG.redisUrl, { maxRetriesPerRequest: null });

  sub.on('error', (e) => console.error('[bot] mini app kanali xatosi:', e.message));

  sub.subscribe(CHANNEL, (err) => {
    if (err) console.error('[bot] mini app kanaliga obuna bo‘lmadi:', err.message);
    else console.log('[bot] mini app buyurtmalari kuzatilmoqda');
  });

  sub.on('message', (_channel, raw) => {
    let msg: { telegramId?: string; orderId?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg.telegramId || !msg.orderId) return;
    // Xatoni yutamiz — bitta buyurtma obunachini yiqitmasin.
    void onOrder(msg.telegramId, msg.orderId).catch((e) =>
      console.error('[bot] mini app buyurtmasini kuzatib bo‘lmadi:', (e as Error).message),
    );
  });
}
