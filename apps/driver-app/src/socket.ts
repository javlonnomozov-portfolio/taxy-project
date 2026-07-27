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
    transports: ['websocket'],
  });
}
