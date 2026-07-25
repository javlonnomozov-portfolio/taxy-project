import Constants from 'expo-constants';

// API manzili app.json > extra.apiUrl dan (yoki default production).
export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://api-production-13444.up.railway.app';
