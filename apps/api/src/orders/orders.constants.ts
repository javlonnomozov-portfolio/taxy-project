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
 * "Taksi topilmadi" (NO_DRIVER) zakaz shuncha vaqt HALI TIRIK: haydovchi onlayn
 * bo'lsa `DispatchService.retryPendingForDriver` uni qayta ko'taradi.
 *
 * Shu sabab bu oynada zakaz mijozga KO'RINISHI kerak (ilova/mini app qayta
 * ochilganda) va mijoz yangi zakaz bersa YOPILISHI kerak. 2026-09-15: ikkalasi
 * yo'q edi — mijoz qayta ochib bo'sh buyurtma ekranini ko'rdi ("zakaz bekor
 * bo'ldi"), haydovchi esa keyin onlayn bo'lib o'sha zakazni qabul qildi.
 * Uchala qoida BITTA qiymatga tayanadi.
 */
export const NO_DRIVER_PENDING_MS = 15 * 60_000;

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
 * `NO_DRIVER` BOR — aks holda mijoz "taksi topilmadi" holatida ilova/bot/mini
 * app'da abadiy qidiruv ekranida qolib, bekor ham qilolmay tiqilib qolardi
 * (mijoz shikoyat qildi: tugma yo'q, "Bekor qilib bo'lmaydi" chiqadi).
 * Jarima yo'q — qarang `TripsService.cancelByCustomer`.
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
  OrderStatus.NO_DRIVER,
];
