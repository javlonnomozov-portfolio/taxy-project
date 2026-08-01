import { OrderStatus } from '@tty/shared';

// Terminal (yakuniy) holatlar — bulardan keyin buyurtma faol emas.
export const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED_BY_CUSTOMER,
  OrderStatus.CANCELLED_BY_DRIVER,
  OrderStatus.CUSTOMER_NO_SHOW,
  OrderStatus.NO_DRIVER,
  OrderStatus.CLOSED_BY_OPERATOR,
];

export const ACTIVE_STATUSES: OrderStatus[] = Object.values(OrderStatus).filter(
  (s) => !TERMINAL_STATUSES.includes(s),
);

/**
 * Haydovchi biriktirilgunga qadar — bu holatlarda bekor qilish JARIMASIZ
 * (agar bepul oynadan chiqib ketmagan bo'lsa).
 */
export const PRE_ACCEPT_STATUSES: OrderStatus[] = [
  OrderStatus.CREATED,
  OrderStatus.DISPATCHING,
];

/**
 * Mijoz bekor qila oladigan holatlar. `IN_PROGRESS` YO'Q — safar boshlangach
 * mijoz bekor qilolmaydi (haydovchi uni yakunlaydi).
 *
 * Ro'yxat bu yerda, chunki uni IKKI joy biladi: `cancelByCustomer` (amal) va
 * mini app (tugmani ko'rsatish). Ikki nusxa bo'lsa biri yangilanmay qolib,
 * ishlamaydigan tugma chiqarib qo'yardi.
 */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
  ...PRE_ACCEPT_STATUSES,
  OrderStatus.ACCEPTED,
  OrderStatus.CONFIRMED,
  OrderStatus.ARRIVING,
  OrderStatus.ARRIVED,
];
