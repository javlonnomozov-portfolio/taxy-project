import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './src/location-task'; // fon location task'ini ro'yxatga olish (top-level)
import { LoginScreen } from './src/screens/LoginScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { storage } from './src/storage';
import { Lang } from './src/i18n';
import { C, S } from './src/theme';
import { LoginResult } from './src/api';

type Screen = 'loading' | 'login' | 'change' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('uz');

  useEffect(() => {
    (async () => {
      const [savedToken, savedLang] = await Promise.all([storage.getToken(), storage.getLang()]);
      if (savedLang === 'ru' || savedLang === 'uz') setLang(savedLang);
      if (savedToken) {
        setToken(savedToken);
        setScreen('home');
      } else {
        setScreen('login');
      }
    })();
  }, []);

  function toggleLang() {
    const next: Lang = lang === 'uz' ? 'ru' : 'uz';
    setLang(next);
    void storage.setLang(next);
  }

  async function onLoggedIn(r: LoginResult) {
    setToken(r.token);
    await storage.setToken(r.token);
    setScreen(r.mustChangePassword ? 'change' : 'home');
  }

  async function logout() {
    await storage.clearToken();
    setToken(null);
    setScreen('login');
  }

  return (
    // DIQQAT: `react-native` ning `SafeAreaView` i ANDROID'DA HECH NARSA QILMAYDI
    // (u faqat iOS uchun). Avval shu ishlatilgan edi va yuqori panel status bar
    // ostiga kirib ketardi — "Kabinet"/"Yopish" tugmalari soat va batareya
    // ikonkalari bilan ustma-ust tushardi.
    // Expo'da status bar shaffof, shuning uchun balandligicha padding beramiz.
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0,
      }}
    >
      <StatusBar style="light" />
      {screen === 'loading' && (
        <View style={[S.screen, S.center, { alignItems: 'center' }]}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      )}
      {screen === 'login' && (
        <LoginScreen lang={lang} onToggleLang={toggleLang} onLoggedIn={onLoggedIn} />
      )}
      {screen === 'change' && token && (
        <ChangePasswordScreen lang={lang} token={token} onDone={() => setScreen('home')} />
      )}
      {screen === 'home' && token && (
        <HomeScreen lang={lang} token={token} onLogout={logout} />
      )}
    </View>
  );
}
