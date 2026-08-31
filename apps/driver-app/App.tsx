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
import { LoginResult, setUnauthorizedHandler } from './src/api';
import { ErrorBoundary } from './src/ErrorBoundary';

type Screen = 'loading' | 'login' | 'change' | 'home';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('uz');
  // Sessiya o'zi tugaganda login ekranida sabab ko'rinsin — aks holda
  // haydovchi "nega meni chiqarib yubordi?" deb qoladi.
  const [expired, setExpired] = useState(false);

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

  /**
   * Token yaroqsiz — login ekraniga qaytaramiz.
   *
   * Avval bunday yo'l YO'Q edi: token muddati tugagach server soketni uzardi,
   * ilova esa "Ulanmoqda…" da abadiy qolib, hech qanday buyurtma olmasdi.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setExpired(true);
      void logout(true); // safar masofasi saqlanadi — o'sha haydovchi qaytadi
    });
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleLang() {
    const next: Lang = lang === 'uz' ? 'ru' : 'uz';
    setLang(next);
    void storage.setLang(next);
  }

  async function onLoggedIn(r: LoginResult) {
    setExpired(false);
    setToken(r.token);
    await storage.setToken(r.token);
    setScreen(r.mustChangePassword ? 'change' : 'home');
  }

  /**
   * @param keepTrip Sessiya O'ZI tugaganda `true`: bu ayni haydovchi, u
   *   qaytadan kiradi va safari `GET /trips/active` bilan tiklanadi —
   *   taksometr masofasini o'chirib yuborsak, u safarni nol masofa bilan
   *   yakunlab, pulini yo'qotardi.
   *   Qo'lda "Chiqish"da esa tozalaymiz: telefonga boshqa haydovchi kirishi
   *   mumkin va begona safar tiklanib qolmasin.
   */
  async function logout(keepTrip = false) {
    await Promise.all([
      storage.clearToken(),
      storage.setWantOnline(false),
      ...(keepTrip ? [] : [storage.clearTripProgress()]),
    ]);
    setToken(null);
    setScreen('login');
  }

  return (
    // ErrorBoundary — ilova jimgina yopilib ketmasin: xato matni ekranda qoladi
    // ("keeps stopping" oynasi sababni ko'rsatmaydi).
    // DIQQAT: `react-native` ning `SafeAreaView` i ANDROID'DA HECH NARSA QILMAYDI
    // (u faqat iOS uchun). Avval shu ishlatilgan edi va yuqori panel status bar
    // ostiga kirib ketardi — "Kabinet"/"Yopish" tugmalari soat va batareya
    // ikonkalari bilan ustma-ust tushardi.
    // Expo'da status bar shaffof, shuning uchun balandligicha padding beramiz.
    <ErrorBoundary>
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0,
      }}
    >
      <StatusBar style="dark" />
      {screen === 'loading' && (
        <View style={[S.screen, S.center, { alignItems: 'center' }]}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      )}
      {screen === 'login' && (
        <LoginScreen
          lang={lang}
          onToggleLang={toggleLang}
          onLoggedIn={onLoggedIn}
          notice={expired ? 'session_expired' : undefined}
        />
      )}
      {screen === 'change' && token && (
        <ChangePasswordScreen lang={lang} token={token} onDone={() => setScreen('home')} />
      )}
      {screen === 'home' && token && (
        // `logout` TO'G'RIDAN uzatilmaydi: u `onPress={onLogout}` orqali
        // chaqirilganda birinchi argument sifatida bosish HODISASI keladi va
        // `keepTrip` tasodifan `true` bo'lib qolardi (qo'lda chiqqanda safar
        // masofasi tozalanmasdi).
        <HomeScreen lang={lang} token={token} onLogout={() => void logout()} />
      )}
    </View>
    </ErrorBoundary>
  );
}
