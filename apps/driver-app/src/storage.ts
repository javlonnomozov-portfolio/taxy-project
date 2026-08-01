import AsyncStorage from '@react-native-async-storage/async-storage';

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
 */
export interface TripProgress {
  orderId: string;
  distanceM: number;
}

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
  setTripProgress: (p: TripProgress) => AsyncStorage.setItem(TRIP_PROGRESS, JSON.stringify(p)),
  clearTripProgress: () => AsyncStorage.removeItem(TRIP_PROGRESS),
};
