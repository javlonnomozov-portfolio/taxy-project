import { io, Socket } from 'socket.io-client';
import type { Telegram } from 'telegraf';
import { CONFIG } from './config';
import { Lang, t } from './i18n';
import { cancelOrderKeyboard, mainMenu, ratingKeyboard } from './keyboards';

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

const TERMINAL = [
  'COMPLETED',
  'NO_DRIVER',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_DRIVER',
  'CUSTOMER_NO_SHOW',
  'CLOSED_BY_OPERATOR',
];

const sockets = new Map<string, Socket>();

// Bitta buyurtma bo'yicha jonli statusni kuzatib, Telegram'ga xabar yuboradi.
export function trackOrder(opts: {
  orderId: string;
  chatId: number;
  customerId: string;
  lang: Lang;
  telegram: Telegram;
  onTerminal: (orderId: string, status: string) => void;
}): void {
  const { orderId, chatId, customerId, lang, telegram, onTerminal } = opts;
  const socket = io(CONFIG.apiBaseUrl + '/customer', {
    auth: { customerId, internalKey: CONFIG.internalKey },
    transports: ['websocket'],
  });
  sockets.set(orderId, socket);

  const send = (text: string, extra?: object) =>
    telegram.sendMessage(chatId, text, extra as never).catch(() => {});

  socket.on('order:status', async (m: StatusMsg) => {
    if (m.orderId !== orderId) return;
    switch (m.status) {
      case 'ACCEPTED':
        if (m.driver)
          await send(
            t(lang, 'driver_found', m.driver.name, m.driver.vehicle || '—', m.driver.plate || '—', m.driver.phone, String(m.driver.ratingAvg ?? 0)),
            cancelOrderKeyboard(lang),
          );
        break;
      case 'ARRIVED':
        await send(t(lang, 'arrived'));
        break;
      case 'IN_PROGRESS':
        await send(t(lang, 'in_progress'));
        break;
      case 'COMPLETED':
        await send(t(lang, 'completed', priceStr(m.finalPrice)), ratingKeyboard());
        break;
      case 'NO_DRIVER':
        await send(t(lang, 'no_driver'), mainMenu(lang));
        break;
      case 'CANCELLED_BY_DRIVER':
      case 'CLOSED_BY_OPERATOR':
      case 'CUSTOMER_NO_SHOW':
        await send(t(lang, 'cancelled'), mainMenu(lang));
        break;
    }
    if (TERMINAL.includes(m.status)) {
      onTerminal(orderId, m.status);
      stopTracking(orderId);
    }
  });
}

export function stopTracking(orderId: string): void {
  const s = sockets.get(orderId);
  if (s) {
    s.close();
    sockets.delete(orderId);
  }
}

function priceStr(v?: number): string {
  return v != null ? Number(v).toLocaleString('ru-RU') + " so'm" : '—';
}
