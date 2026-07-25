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
