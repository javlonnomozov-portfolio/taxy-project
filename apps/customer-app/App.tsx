import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { storage } from './src/storage';
import { setUnauthorizedHandler } from './src/api';
import { Lang } from './src/i18n';
import { C, S } from './src/theme';
import { ErrorBoundary } from './src/ErrorBoundary';

type Screen = 'loading' | 'login' | 'home' | 'account';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('uz');
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

  // Token yaroqsiz bo'lsa DARHOL login ekraniga — sababi bilan.
  // Haydovchi ilovasida bu yo'q edi va ilova cheksiz "Ulanmoqda…" da qotardi.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setExpired(true);
      void storage.clearToken();
      setToken(null);
      setScreen('login');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  function changeLang(next: Lang) {
    setLang(next);
    void storage.setLang(next);
  }

  function toggleLang() {
    changeLang(lang === 'uz' ? 'ru' : 'uz');
  }

  async function onLoggedIn(t: string) {
    setExpired(false);
    setToken(t);
    await storage.setToken(t);
    setScreen('home');
  }

  async function logout() {
    await storage.clearToken();
    setToken(null);
    setScreen('login');
  }

  return (
    <ErrorBoundary>
      {/*
        Status bar TAGIDAN joy AJRATILMAYDI — xarita to'liq ekran bo'ylab
        cho'ziladi (maketdagidek). Kerak bo'lgan ekranlar (kirish, kabinet)
        o'z chekkasini o'zi qo'yadi.
      */}
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" translucent />
        {screen === 'loading' && (
          <View style={[S.screen, S.center, { alignItems: 'center' }]}>
            <ActivityIndicator color={C.accent} size="large" />
          </View>
        )}
        {screen === 'login' && (
          <LoginScreen
            lang={lang}
            notice={expired ? 'session_expired' : undefined}
            onToggleLang={toggleLang}
            onLoggedIn={onLoggedIn}
          />
        )}
        {screen === 'home' && token && (
          <HomeScreen lang={lang} token={token} onOpenAccount={() => setScreen('account')} />
        )}
        {screen === 'account' && token && (
          <AccountScreen
            lang={lang}
            token={token}
            initial="history"
            onClose={() => setScreen('home')}
            onLangChange={changeLang}
            onLogout={logout}
          />
        )}
      </View>
    </ErrorBoundary>
  );
}
