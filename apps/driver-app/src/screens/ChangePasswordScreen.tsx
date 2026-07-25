import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { driverApi } from '../api';
import { S, C } from '../theme';
import { Lang, makeT } from '../i18n';

export function ChangePasswordScreen({
  lang,
  token,
  onDone,
}: {
  lang: Lang;
  token: string;
  onDone: () => void;
}) {
  const t = makeT(lang);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr('');
    if (pw.length < 6) {
      setErr(t('change_hint'));
      return;
    }
    setBusy(true);
    try {
      await driverApi.changePassword(pw, token);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[S.screen, S.center]}>
      <Text style={S.title}>{t('change_title')}</Text>
      <Text style={S.subtitle}>{t('change_hint')}</Text>
      <Text style={S.label}>{t('new_password')}</Text>
      <TextInput
        style={S.input}
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={C.muted}
      />
      {err ? <Text style={S.err}>{err}</Text> : null}
      <TouchableOpacity style={S.btn} onPress={submit} disabled={busy}>
        <Text style={S.btnText}>{busy ? '…' : t('save')}</Text>
      </TouchableOpacity>
    </View>
  );
}
