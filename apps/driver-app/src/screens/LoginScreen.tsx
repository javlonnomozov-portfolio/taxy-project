import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { driverApi, LoginResult } from '../api';
import { S, C } from '../theme';
import { Lang, makeT } from '../i18n';

export function LoginScreen({
  lang,
  onToggleLang,
  onLoggedIn,
}: {
  lang: Lang;
  onToggleLang: () => void;
  onLoggedIn: (r: LoginResult) => void;
}) {
  const t = makeT(lang);
  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    setBusy(true);
    try {
      const res = await driverApi.login(phone.trim(), password);
      onLoggedIn(res);
    } catch {
      setErr(t('login_err'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[S.screen, S.center]}>
      <Text style={S.title}>{t('app_name')}</Text>
      <Text style={S.subtitle}>{t('login')}</Text>

      <Text style={S.label}>{t('phone')}</Text>
      <TextInput
        style={S.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+998901234567"
        placeholderTextColor={C.muted}
        autoCapitalize="none"
      />
      <Text style={S.label}>{t('password')}</Text>
      <TextInput
        style={S.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={C.muted}
      />
      {err ? <Text style={S.err}>{err}</Text> : null}
      <TouchableOpacity style={S.btn} onPress={submit} disabled={busy}>
        <Text style={S.btnText}>{busy ? '…' : t('login_btn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 18, alignItems: 'center' }} onPress={onToggleLang}>
        <Text style={{ color: C.accent }}>{t('lang_switch')}</Text>
      </TouchableOpacity>
    </View>
  );
}
