import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
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
    </SafeAreaView>
  );
}
