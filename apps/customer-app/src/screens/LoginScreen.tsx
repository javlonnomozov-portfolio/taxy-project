import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { C, F, R, S, SP } from '../theme';
import { Lang, makeT } from '../i18n';

interface StartResp {
  nonce: string;
  deepLink: string;
  expiresInSec: number;
}

/**
 * Kirish — Telegram bot orqali, parolsiz.
 *
 * IKKI YO'L, bittasi ikkinchisining zaxirasi:
 *  1. Deep link ochiladi, ilova `poll` qilib turadi va O'ZI kiradi.
 *  2. Deep link ishlamasa (Telegram boshqa telefonda, brauzer ushlab qolgan)
 *     — botdagi 6 xonali kod qo'lda kiritiladi.
 *
 * Zaxira yo'lsiz foydalanuvchi boshi berk ko'chada qolardi.
 */
export function LoginScreen({
  lang,
  notice,
  onToggleLang,
  onLoggedIn,
}: {
  lang: Lang;
  notice?: string;
  onToggleLang: () => void;
  onLoggedIn: (token: string) => void;
}) {
  const t = makeT(lang);
  const [start, setStart] = useState<StartResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => stopPoll, [stopPoll]);

  async function begin() {
    setErr(null);
    setBusy(true);
    try {
      const r = await api<StartResp>('POST', '/auth/customer/start', {});
      setStart(r);
      await Linking.openURL(r.deepLink).catch(() => {
        // Telegram o'rnatilmagan bo'lishi mumkin — kod yo'li ochiq qoladi.
      });
      stopPoll();
      pollRef.current = setInterval(() => void poll(r.nonce), 3000);
    } catch (e) {
      setErr((e as Error).message || t('err_network'));
    } finally {
      setBusy(false);
    }
  }

  async function poll(nonce: string) {
    try {
      const r = await api<{ token: string | null }>('POST', '/auth/customer/poll', { nonce });
      if (r.token) {
        stopPoll();
        onLoggedIn(r.token);
      }
    } catch {
      // 404 = muddati tugadi. Kutishni to'xtatamiz va sababni KO'RSATAMIZ —
      // jimgina aylanaversa foydalanuvchi nima bo'layotganini bilmaydi.
      stopPoll();
      setStart(null);
      setErr(t('login_expired'));
    }
  }

  async function submitCode() {
    if (!start || code.length !== 6) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string }>('POST', '/auth/customer/verify', {
        nonce: start.nonce,
        code,
      });
      stopPoll();
      onLoggedIn(r.token);
    } catch (e) {
      setErr((e as Error).message || t('err'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[S.screen, { justifyContent: 'center' }]}>
      <TouchableOpacity
        onPress={onToggleLang}
        style={{ position: 'absolute', top: SP.xl, right: SP.xl, padding: SP.sm }}
      >
        <Text style={{ color: C.accent, fontWeight: '700' }}>{t('lang_switch')}</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginBottom: SP.xxl }}>
        <MaterialIcons name="local-taxi" size={56} color={C.accent} />
        <Text style={[S.title, { marginTop: SP.md }]}>{t('login_title')}</Text>
        <Text style={[S.subtitle, { textAlign: 'center' }]}>{t('login_sub')}</Text>
      </View>

      {notice ? (
        <View style={[S.errBox, { marginBottom: SP.lg }]}>
          <Text style={{ color: C.warn, fontSize: F.label }}>{t(notice)}</Text>
        </View>
      ) : null}

      {!start ? (
        <TouchableOpacity style={S.btn} onPress={begin} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="#FFFFFF" />
              <Text style={[S.btnText, { marginLeft: 8 }]}>{t('login_btn')}</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View>
          <View style={[S.row, { justifyContent: 'center', gap: SP.sm }]}>
            <ActivityIndicator color={C.accent} />
            <Text style={{ color: C.text, fontSize: F.body }}>{t('login_waiting')}</Text>
          </View>

          <Text style={[S.label, { marginTop: SP.xxl }]}>{t('login_code_hint')}</Text>
          <TextInput
            style={[S.input, { fontSize: 24, letterSpacing: 6, textAlign: 'center' }]}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder={t('login_code_ph')}
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity
            style={[S.btn, code.length !== 6 && { opacity: 0.5 }]}
            onPress={submitCode}
            disabled={code.length !== 6 || busy}
          >
            <Text style={S.btnText}>{t('login_code_btn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={begin} style={{ alignItems: 'center', paddingVertical: SP.lg }}>
            <Text style={{ color: C.muted }}>{t('login_retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {err ? <Text style={[S.err, { marginTop: SP.lg, textAlign: 'center' }]}>{err}</Text> : null}
    </View>
  );
}
