import { io, Socket } from 'socket.io-client';
import { API_URL } from './config';

// Server bilan bir xil event nomlari (packages/shared/socket.ts bilan mos).
export const EV = {
  online: 'driver:online',
  offline: 'driver:offline',
  location: 'driver:location',
  offerResponse: 'driver:offer_response',
  tripConfirm: 'trip:confirm',
  tripArrived: 'trip:arrived',
  tripStart: 'trip:start',
  tripComplete: 'trip:complete',
  tripCancel: 'trip:cancel',
  sos: 'sos',
  // server → client
  orderOffer: 'order:offer',
  orderOfferCancelled: 'order:offer_cancelled',
  orderAssigned: 'order:assigned',
  tripEnded: 'trip:ended', // safar tashqi sabab bilan tugadi (mijoz/operator bekor qildi)
} as const;

/**
 * Server handler xato tashlaganda shu shaklda ack qaytaradi
 * (API tomonda `WsErrorInterceptor`). Muvaffaqiyatda `ok: true` yoki natija obyekti.
 */
export interface SocketAck {
  ok?: boolean;
  code?: string;
  message?: string;
}

export function connectDriver(token: string): Socket {
  return io(API_URL + '/driver', {
    auth: { token },
    // MUHIM: faqat 'websocket' MAJBURLANMAYDI. Ba'zi mobil tarmoqlar va korporativ
    // proksilar WS'ni bloklaydi — o'shanda zaxira yo'l bo'lmasa haydovchi umuman
    // ulana olmaydi va ilova "Ulanmoqda…" holatida qotib qoladi. Polling bilan
    // ulanib, imkon bo'lsa WS'ga ko'tariladi.
    transports: ['websocket', 'polling'],
    // Tarmoq uzilsa o'zi qayta ulansin (haydovchi kun bo'yi harakatda).
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 20_000,
  });
}
