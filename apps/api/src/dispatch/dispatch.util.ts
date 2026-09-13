/**
 * Dispatch'ning SOF mantiqi — DB/Redis/socket'siz, shuning uchun to'g'ridan test qilinadi.
 * (Avval bu kod `DispatchService` ichida private edi va unit test yozib bo'lmasdi.)
 */
import { VehicleCategory } from '@tty/shared';

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
