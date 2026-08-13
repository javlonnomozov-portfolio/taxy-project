import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { driverApi, LoginResult } from '../api';
import { S, C, R, F, SP } from '../theme';
import { Lang, makeT } from '../i18n';

export function LoginScreen({
  lang,
  onToggleLang,
  onLoggedIn,
  notice,
}: {
  lang: Lang;
  onToggleLang: () => void;
  onLoggedIn: (r: LoginResult) => void;
  /** Nega login ekraniga qaytdik (masalan sessiya muddati tugadi) — i18n kaliti. */
  notice?: string;
}) {
  const t = makeT(lang);
  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={S.topBar}>
        <View style={[S.row, { gap: SP.sm }]}>
          <MaterialIcons name="local-taxi" size={22} color={C.accent} />
          <Text style={S.brand}>Toy TaxY</Text>
        </View>
        <TouchableOpacity onPress={onToggleLang} hitSlop={12}>
          <Text style={{ color: C.muted, fontSize: 15, fontWeight: '600' }}>
            {lang === 'uz' ? 'UZ / ru' : 'uz / RU'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SP.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: C.text, fontSize: F.display, fontWeight: '800' }}>
          {t('welcome')}
        </Text>
        <Text style={[S.subtitle, { marginTop: 6 }]}>{t('login_sub')}</Text>

        {notice ? (
          <View
            style={{
              backgroundColor: C.warnSoft,
              borderColor: 'rgba(255, 176, 32, 0.35)',
              borderWidth: 1,
              borderRadius: R.sm,
              padding: SP.md,
              marginBottom: SP.lg,
            }}
          >
            <Text style={{ color: C.warn, fontSize: F.label }}>{t(notice)}</Text>
          </View>
        ) : null}

        <View style={S.card}>
          <Text style={S.label}>{t('phone')}</Text>
          <Field icon="phone">
            <TextInput
              style={fieldInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+998 90 123 45 67"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
            />
          </Field>

          <Text style={[S.label, { marginTop: SP.lg }]}>{t('password')}</Text>
          <Field icon="lock">
            <TextInput
              style={fieldInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
              <MaterialIcons
                name={showPw ? 'visibility-off' : 'visibility'}
                size={22}
                color={C.muted}
              />
            </TouchableOpacity>
          </Field>

          {/* Xato POPUP emas — ekranda qoladi, haydovchi uni support'ga o'qib berishi mumkin. */}
          {err ? (
            <View style={[S.errBox, { marginTop: SP.lg }]}>
              <Text style={{ color: C.danger, fontSize: F.label }}>{err}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[S.btn, { marginTop: SP.xl }, busy && { opacity: 0.6 }]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={S.btnText}>{busy ? '…' : t('login_btn')}</Text>
          </TouchableOpacity>
        </View>

        {/* O'zi ro'yxatdan o'tish YO'Q — hisobni ofis yaratadi. */}
        <Text style={{ color: C.muted, fontSize: F.label, textAlign: 'center', marginTop: SP.xxl }}>
          {t('account_from_office')}
        </Text>
      </ScrollView>
    </View>
  );
}

const fieldInput = {
  flex: 1,
  color: C.text,
  fontSize: F.body,
  paddingVertical: 0,
} as const;

/** Ikonkali input konteyneri (ikonka | maydon | o'ng amal). */
function Field({
  icon,
  children,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  return (
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
      <MaterialIcons name={icon} size={20} color={C.muted} />
      {children}
    </View>
  );
}
