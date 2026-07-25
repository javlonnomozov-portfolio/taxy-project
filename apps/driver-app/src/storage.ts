import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN = 'tty_driver_token';
const LANG = 'tty_driver_lang';

export const storage = {
  getToken: () => AsyncStorage.getItem(TOKEN),
  setToken: (t: string) => AsyncStorage.setItem(TOKEN, t),
  clearToken: () => AsyncStorage.removeItem(TOKEN),
  getLang: () => AsyncStorage.getItem(LANG),
  setLang: (l: string) => AsyncStorage.setItem(LANG, l),
};
