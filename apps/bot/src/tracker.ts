import { io, Socket } from 'socket.io-client';
import type { Telegram } from 'telegraf';
import { CONFIG } from './config';
import { Lang, t } from './i18n';
import { mainMenu, ratingKeyboard, trackingKeyboard } from './keyboards';

interface DriverCard {
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  ratingAvg: number;
}
interface StatusMsg {
  orderId: string;
  status: string;
  driver?: DriverCard;
  finalPrice?: number;
  penalized?: boolean;
}

// DIQQAT: `NO_DRIVER` bu yerda YO'Q — u backend uchun yakuniy emas.
// Zakaz NO_DRIVER'da qolganda operator hali ham haydovchi biriktirishi mumkin
// (`/ops/orders/:id/assign`), va keyinroq onlayn bo'lgan haydovchiga avtomatik
// qayta taklif ham boradi. Avval NO_DRIVER'da socket YOPILARDI — shuning uchun
// operator biriktirgach mijozga hech narsa kelmasdi.
const TERMINAL = [
  'COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_DRIVER',
  'CUSTOMER_NO_SHOW',
  'CLOSED_BY_OPERATOR',
];

// NO_DRIVER'dan keyin qancha vaqt kuzatishda qolamiz (operator/kech onlayn
// haydovchi uchun). API tomonidagi qayta urinish oynasi ham 15 daqiqa.
const NO_DRIVER_WATCH_MS = 15 * 60_000;

const sockets = new Map<string, Socket>();
const watchdogs = new Map<string, NodeJS.Timeout>();

// Bitta buyurtma bo'yicha jonli statusni kuzatib, Telegram'ga xabar yuboradi.
export function trackOrder(opts: {
  orderId: string;
  chatId: number;
  customerId: string;
  lang: Lang;
  telegram: Telegram;
  /** Sessiya buxgalteriyasi. Promise qaytarishi mumkin — biz uni KUTAMIZ. */
  onTerminal: (orderId: string, status: string) => void | Promise<void>;
  /** Zakaz NO_DRIVER'dan keyin jonlandi (operator biriktirdi / haydovchi topildi). */
  onAssigned?: (orderId: string) => void | Promise<void>;
}): void {
  const { orderId, chatId, customerId, lang, telegram, onTerminal, onAssigned } = opts;
  const socket = io(CONFIG.apiBaseUrl + '/customer', {
    auth: { customerId, internalKey: CONFIG.internalKey },
    transports: ['websocket'],
  });
  sockets.set(orderId, socket);

  const send = (text: string, extra?: object) =>
    telegram.sendMessage(chatId, text, extra as never).catch(() => {});

  socket.on('order:status', async (m: StatusMsg) => {
    if (m.orderId !== orderId) return;

    // SESSIYA BUXGALTERIYASI XABARLARDAN OLDIN va KUTIB bajariladi.
    // Avval u xabarlardan keyin, ustiga `void` bilan (kutilmasdan) chaqirilardi:
    // mijoz "Safar yakunlandi" xabarini ko'rgan zahoti bahoni bosishi mumkin,
    // o'shanda `ratingOrderId` hali yozilmagan bo'lib, baho jimgina yo'qolardi.
    const isTerminal = TERMINAL.includes(m.status);
    if (isTerminal || m.status === 'NO_DRIVER') await onTerminal(orderId, m.status);

    switch (m.status) {
      case 'ACCEPTED':
        // NO_DRIVER'dan keyin kelgan bo'lishi mumkin — sessiyada zakazni
        // yana faol qilamiz, aks holda mijoz uni bekor qila olmay qoladi.
        clearWatchdog(orderId);
        await onAssigned?.(orderId);
        if (m.driver)
          await send(
            t(lang, 'driver_found', m.driver.name, m.driver.vehicle || '—', m.driver.plate || '—', m.driver.phone, String(m.driver.ratingAvg ?? 0)),
            trackingKeyboard(lang, orderId),
          );
        break;
      case 'ARRIVED':
        await send(t(lang, 'arrived'));
        break;
      case 'IN_PROGRESS':
        await send(t(lang, 'in_progress'));
        break;
      case 'COMPLETED':
        await send(t(lang, 'completed', priceStr(m.finalPrice)), ratingKeyboard(lang));
        // Asosiy menyuni DARHOL qaytaramiz — bitta yo'lga tayanib qolmaymiz.
        // Avval u faqat baho berilgandan keyin qaytardi, ya'ni mijoz baholamasa
        // "Taksi chaqirish" tugmasi umuman ko'rinmay qolardi.
        await send(t(lang, 'use_menu'), mainMenu(lang));
        break;
      case 'NO_DRIVER':
        await send(t(lang, 'no_driver'), mainMenu(lang));
        // Zakaz sessiyada allaqachon bo'shatildi (mijoz yangi zakaz bera olsin),
        // LEKIN kuzatuvni saqlab qolamiz — operator yoki kech onlayn bo'lgan
        // haydovchi hali ham bu zakazni olishi mumkin.
        armWatchdog(orderId);
        return;
      case 'CANCELLED_BY_DRIVER':
      case 'CLOSED_BY_OPERATOR':
      case 'CUSTOMER_NO_SHOW':
        await send(t(lang, 'cancelled'), mainMenu(lang));
        break;
    }
    if (isTerminal) stopTracking(orderId);
  });
}

export function stopTracking(orderId: string): void {
  clearWatchdog(orderId);
  const s = sockets.get(orderId);
  if (s) {
    s.close();
    sockets.delete(orderId);
  }
}

/** NO_DRIVER'dan keyin socket abadiy ochiq qolmasin — chegaralangan oyna. */
function armWatchdog(orderId: string): void {
  clearWatchdog(orderId);
  watchdogs.set(
    orderId,
    setTimeout(() => {
      watchdogs.delete(orderId);
      stopTracking(orderId);
    }, NO_DRIVER_WATCH_MS),
  );
}

function clearWatchdog(orderId: string): void {
  const w = watchdogs.get(orderId);
  if (w) {
    clearTimeout(w);
    watchdogs.delete(orderId);
  }
}

function priceStr(v?: number): string {
  return v != null ? Number(v).toLocaleString('ru-RU') + " so'm" : '—';
}
