import Constants from 'expo-constants';

// API manzili `app.json` → `extra.apiUrl` dan. Bitta joyda — buildga qarab
// o'zgartirish uchun kodga tegish shart emas.
export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://api-production-13444.up.railway.app';
