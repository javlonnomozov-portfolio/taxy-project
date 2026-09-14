import { io, Socket } from 'socket.io-client';
import { API_URL } from './config';

/**
 * Mijoz jonli kanali (`/customer`).
 *
 * NEGA KERAK: ilova zakaz holatini har 5 soniyada so'rab turardi — safar
 * davomida yuzlab so'rov, batareya va server yuki. Endi holat o'zgarganda
 * server O'ZI aytadi; so'rov faqat shundan keyin (yagona haqiqat manbai
 * baribir server javobi).
 *
 * TOKEN: mijoz JWT'si. Ilovaga `INTERNAL_API_KEY` berib bo'lmaydi — u butun
 * ichki API'ni ochadi va APK ichidan chiqarib olinadi. Server tomonida shu
 * sabab alohida JWT yo'li qo'shilgan (`customer.gateway.ts`).
 */
export function connectCustomer(token: string): Socket {
  return io(API_URL + '/customer', {
    auth: { token },
    transports: ['websocket'],
    // Tarmoq uzilsa o'zi qayta ulanadi; uzilgan paytdagi o'zgarishni
    // zaxira so'rov (30 s) baribir olib keladi.
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
}
