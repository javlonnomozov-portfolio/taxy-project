import { io, Socket } from 'socket.io-client';
import { API_URL, auth } from './api';

// Operator jonli kanali (/ops).
export function connectOps(): Socket {
  return io(API_URL + '/ops', {
    auth: { token: auth.token },
    transports: ['websocket'],
  });
}
