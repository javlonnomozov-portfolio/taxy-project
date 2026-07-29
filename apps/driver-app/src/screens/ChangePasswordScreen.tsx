import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { driverApi } from '../api';
import { S, C, R, F, SP } from '../theme';
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
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const longEnough = pw.length >= 6;

  async function submit() {
    setErr('');
    if (!longEnough) {
      setErr(t('pw_min'));
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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={S.topBar}>
        <View style={[S.row, { gap: SP.sm }]}>
          <MaterialIcons name="local-taxi" size={22} color={C.accent} />
          <Text style={S.brand}>Toy TaxY</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: SP.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: C.text, fontSize: F.title + 4, fontWeight: '800', marginTop: SP.xl }}>
          {t('change_title')}
        </Text>
        <Text style={[S.subtitle, { marginTop: SP.sm }]}>{t('change_sub')}</Text>

        <Text style={S.label}>{t('new_password')}</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SP.md,
            backgroundColor: C.panel2,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: R.md,
            paddingHorizontal: SP.lg,
            height: 56,
          }}
        >
          <MaterialIcons name="lock" size={20} color={C.muted} />
          <TextInput
            style={{ flex: 1, color: C.text, fontSize: F.body, paddingVertical: 0 }}
            value={pw}
            onChangeText={setPw}
            secureTextEntry={!showPw}
            placeholder="••••••••"
            placeholderTextColor={C.muted}
            autoFocus
          />
          <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
            <MaterialIcons
              name={showPw ? 'visibility-off' : 'visibility'}
              size={22}
              color={C.muted}
            />
          </TouchableOpacity>
        </View>

        {/* Jonli tekshiruv — haydovchi "Saqlash"ni bosgunча kutmasin. */}
        <View style={[S.row, { gap: 6, marginTop: SP.md }]}>
          <MaterialIcons
            name={longEnough ? 'check-circle' : 'info-outline'}
            size={16}
            color={longEnough ? C.online : C.muted}
          />
          <Text style={{ color: longEnough ? C.online : C.muted, fontSize: F.label }}>
            {t('pw_min')}
          </Text>
        </View>

        {err ? (
          <View style={[S.errBox, { marginTop: SP.lg }]}>
            <Text style={{ color: C.danger, fontSize: F.label }}>{err}</Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* "Keyinroq" varianti YO'Q — parol almashtirish majburiy. */}
        <TouchableOpacity
          style={[S.btn, { marginTop: SP.xxl }, (busy || !longEnough) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={busy || !longEnough}
        >
          <Text style={S.btnText}>{busy ? '…' : t('save')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
