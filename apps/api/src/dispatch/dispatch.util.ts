/**
 * Dispatch'ning SOF mantiqi — DB/Redis/socket'siz, shuning uchun to'g'ridan test qilinadi.
 * (Avval bu kod `DispatchService` ichida private edi va unit test yozib bo'lmasdi.)
 */
import { OrderStatus, VehicleCategory } from '@tty/shared';

/**
 * Haydovchi qaysi TOIFADAGI buyurtmalarni oladi.
 *
 * Comfort mashina Standart buyurtmani ham oladi — bir tomonlama: Standart
 * mashina Comfort buyurtmani KO'RMAYDI (aks holda Comfort toifasining ma'nosi
 * qolmasdi). Yuk mashinasi butunlay alohida.
 *
 * NEGA KERAK BO'LDI: 2026-09-13 da mijoz Standart zakaz berdi, haydovchi
 * ishni boshladi, lekin zakaz unga KO'RINMADI — uning mashinasi Comfort
 * toifasida edi. Kichik shaharda toifani qat'iy ajratish "taksi topilmadi"
 * degani, bo'sh turgan mashina bor bo'lsa ham.
 *
 * NARX BUNGA BOG'LIQ EMAS: hisob `order.vehicleCategory` (mijoz TANLAGAN
 * toifa) bo'yicha chiqadi, mashina toifasi bo'yicha emas. Ya'ni Comfort
 * mashina Standart zakazni olsa, mijoz Standart narx to'laydi — unga
 * ko'rsatilgan narx. Haydovchi ilovasida bunday zakaz BOSHQA rangda
 * ko'rinadi, u nimaga rozi bo'layotganini bilsin.
 */
export function servedCategories(vehicle: VehicleCategory): VehicleCategory[] {
  if (vehicle === VehicleCategory.COMFORT) {
    return [VehicleCategory.COMFORT, VehicleCategory.STANDARD];
  }
  return [vehicle];
}

/** `servedCategories` ning teskarisi: shu toifadagi buyurtmani kim ola oladi. */
export function servingVehicles(order: VehicleCategory): VehicleCategory[] {
  return Object.values(VehicleCategory).filter((v) => servedCategories(v).includes(order));
}

/** Comfort qidiruvi shuncha soniyadan keyin Standart taklif qilinadi (sukut). */
export const COMFORT_SUGGEST_AFTER_SEC = 60;

/**
 * Mijozga "Standart buyurtma berish" taklifi QACHON ko'rsatiladi.
 *
 * NEGA VAQT BO'YICHA: Comfort haydovchi onlayn bo'lib taklifga javob bermasa,
 * taklif muddatsiz turadi va zakaz hech qachon NO_DRIVER'ga tushmaydi — avval
 * faqat NO_DRIVER'da chiqadigan tugma bunday holatda umuman ko'rinmasdi.
 * Taklif chiqqanda Comfort qidiruvi TO'XTAMAYDI (foydalanuvchi qarori).
 *
 * `null` — bu zakazga taklif tegishli emas (Comfort emas yoki qidiruv tugagan).
 */
export function standardSuggestAt(
  o: { status: string; vehicleCategory: string; createdAt: Date | string },
  afterSec: number = COMFORT_SUGGEST_AFTER_SEC,
): Date | null {
  if (o.vehicleCategory !== VehicleCategory.COMFORT) return null;
  // Qidiruv to'xtagan — kutishning ma'nosi yo'q, darhol.
  if (o.status === OrderStatus.NO_DRIVER) return new Date(o.createdAt);
  if (o.status !== OrderStatus.DISPATCHING) return null;
  return new Date(new Date(o.createdAt).getTime() + Math.max(0, afterSec) * 1000);
}

export function canSuggestStandard(
  o: { status: string; vehicleCategory: string; createdAt: Date | string },
  now: Date = new Date(),
  afterSec: number = COMFORT_SUGGEST_AFTER_SEC,
): boolean {
  const at = standardSuggestAt(o, afterSec);
  return !!at && now.getTime() >= at.getTime();
}

export interface Candidate {
  driverId: string;
  distanceM: number;
}

/** Ikki koordinata orasidagi masofa (metr), haversine. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Reyting tie-break uchun masofa "bucket"i — shu oraliq ichida masofa teng deb qaraladi. */
export const RATING_BUCKET_M = 200;

/**
 * Nomzodlarni tartiblaydi (2.4): asosiy mezon — masofa, lekin ~200 m bucket ichida
 * yuqori reytingli haydovchi oldinroq taklif oladi. Reyting ham teng bo'lsa — aniq masofa.
 *
 * Massivni JOYIDA (in-place) tartiblaydi va o'zini qaytaradi.
 */
export function sortCandidates<T extends Candidate>(
  candidates: T[],
  ratingOf: (driverId: string) => number,
): T[] {
  const bucket = (m: number) => Math.round(m / RATING_BUCKET_M);
  return candidates.sort((a, b) => {
    const bd = bucket(a.distanceM) - bucket(b.distanceM);
    if (bd !== 0) return bd;
    const rd = ratingOf(b.driverId) - ratingOf(a.driverId);
    if (rd !== 0) return rd;
    return a.distanceM - b.distanceM;
  });
}
