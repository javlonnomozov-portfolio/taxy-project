import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversine, type LatLng } from './geo';

const TOKEN = 'tty_driver_token';
const LANG = 'tty_driver_lang';
const WANT_ONLINE = 'tty_driver_want_online';
const TRIP_PROGRESS = 'tty_driver_trip_progress';

/**
 * Safar davomida FAQAT ilova biladigan qiymat — taksometr masofasi.
 *
 * Boshqa hamma narsani (bosqich, mijoz, tarif) serverdan `GET /trips/active`
 * bilan tiklaymiz; masofani esa server umuman bilmaydi — u faqat safar
 * yakunlanganda `trip:complete` bilan yuboriladi. Shuning uchun ilova
 * o'ldirilsa masofa YO'QOLADI, agar bu yerda saqlanmasa.
 *
 * Bu yozuv taksometrning YAGONA manbai (2026-09-15). Avval masofa faqat
 * ekrandagi holatda sanalib, 15 soniyada bir saqlanardi: ilova yopilganda
 * oxirgi soniyalar ham, yopiq paytda yurilgan yo'l ham yo'qolardi (haydovchi:
 * "4 124 so'm edi, qayta ochganda 4 094"). Endi har GPS nuqtasi shu yozuvga
 * qo'shiladi — ilova ekranda bo'lsa `HomeScreen`, bo'lmasa fon vazifasi.
 */
export interface TripProgress {
  orderId: string;
  distanceM: number;
  /** Safar boshlanganmi — masofa faqat shunda sanaladi (fon vazifasi bosqichni boshqa yerdan bilmaydi). */
  inProgress?: boolean;
  /** Oxirgi sanalgan nuqta — keyingisi shundan o'lchanadi, orada ilova yopilgan bo'lsa ham. */
  last?: LatLng | null;
}

const writeProgress = (p: TripProgress) => AsyncStorage.setItem(TRIP_PROGRESS, JSON.stringify(p));

export const storage = {
  getToken: () => AsyncStorage.getItem(TOKEN),
  setToken: (t: string) => AsyncStorage.setItem(TOKEN, t),
  clearToken: () => AsyncStorage.removeItem(TOKEN),
  getLang: () => AsyncStorage.getItem(LANG),
  setLang: (l: string) => AsyncStorage.setItem(LANG, l),

  /** Haydovchi "Ishni boshlash"ni bosganmi — ilova qayta ochilganda tiklanadi. */
  getWantOnline: async () => (await AsyncStorage.getItem(WANT_ONLINE)) === '1',
  setWantOnline: (v: boolean) => AsyncStorage.setItem(WANT_ONLINE, v ? '1' : '0'),

  getTripProgress: async (): Promise<TripProgress | null> => {
    const raw = await AsyncStorage.getItem(TRIP_PROGRESS);
    if (!raw) return null;
    try {
      const p = JSON.parse(raw) as TripProgress;
      return typeof p?.orderId === 'string' && typeof p?.distanceM === 'number' ? p : null;
    } catch {
      return null; // buzilgan yozuv tiklashni yiqitmasin
    }
  },

  /**
   * Safar bosqichi o'zgardi (yoki ilova qayta ochilib safar tiklandi).
   *
   * Shu zakazning yig'ilgan masofasi va oxirgi nuqtasi SAQLANADI — tiklash
   * ham shu yerdan o'tadi va u yig'ilganni nolga tushirmasligi kerak.
   * `here` faqat birinchi nuqta bo'ladi: safar boshlangan joydan sanaladi.
   */
  markTripStage: async (orderId: string, inProgress: boolean, here: LatLng | null): Promise<void> => {
    const cur = await storage.getTripProgress();
    const same = cur !== null && cur.orderId === orderId;
    await writeProgress({
      orderId,
      distanceM: same ? cur.distanceM : 0,
      inProgress,
      last: same && cur.last ? cur.last : here,
    });
  },

  /**
   * Taksometrga bitta GPS nuqtasi. Safar boshlanmagan bo'lsa hech narsa qilmaydi.
   *
   * Masofa SAQLANGAN oxirgi nuqtadan o'lchanadi — shuning uchun ilova yopiq
   * turgan va fon joylashuvi ishlamagan oraliq ham yo'qolmaydi, kamida to'g'ri
   * chiziq bo'lib qo'shiladi. Bir nuqtani ikki manba qo'shmasligini
   * chaqiruvchilar `AppState` bo'yicha ta'minlaydi.
   */
  addTripPoint: async (loc: LatLng): Promise<TripProgress | null> => {
    const cur = await storage.getTripProgress();
    if (!cur?.inProgress) return null;
    const next: TripProgress = {
      ...cur,
      distanceM: cur.last ? cur.distanceM + haversine(cur.last, loc) : cur.distanceM,
      last: loc,
    };
    await writeProgress(next);
    return next;
  },

  clearTripProgress: () => AsyncStorage.removeItem(TRIP_PROGRESS),
};
