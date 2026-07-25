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
} as const;

export function connectDriver(token: string): Socket {
  return io(API_URL + '/driver', {
    auth: { token },
    transports: ['websocket'],
  });
}
