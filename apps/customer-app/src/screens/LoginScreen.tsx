import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { C, F, S, SP } from '../theme';
import { Lang, makeT } from '../i18n';

interface StartResp {
  nonce: string;
  deepLink: string;
  expiresInSec: number;
}

type Phase = 'idle' | 'waiting' | 'code';

/**
 * Status bar balandligi — `App.tsx` endi umumiy chekka QO'YMAYDI (xarita
 * to'liq ekran bo'ylab cho'zilsin uchun), shuning uchun uni shu ekran
 * o'zi hisoblaydi. `SafeAreaView` Android'da hech narsa qilmaydi.
 */
const STATUS_PAD = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 44;

/**
 * Kirish — Telegram bot orqali, parolsiz.
 *
 * KOD MAJBURIY. Deep link ochiladi, bot 6 xonali kod beradi va u SHU
 * qurilmaga kiritiladi.
 *
 * Nega avtomatik kirish OLIB TASHLANDI: tasdiqlovchi va ilovani ushlab
 * turgan odam boshqa-boshqa bo'lishi mumkin. Hujumchi o'z ilovasida havola
 * yaratib uni qurbonga yuborsa ("shuni bosib bering"), qurbon Telegram'da
 * tasdiqlaydi va HUJUMCHINING ilovasi qurbon hisobiga kirib olardi. Kod
 * ikkalasi bir odam ekanini bog'laydi.
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
  const [phase, setPhase] = useState<Phase>('idle');
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
      setPhase('waiting');
      await Linking.openURL(r.deepLink).catch(() => {
        // Telegram o'rnatilmagan bo'lishi mumkin — kod maydoni baribir ochiq.
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
      // Token BERMAYDI — faqat "bot tasdiqladi" holati. Token uchun kod kerak.
      const r = await api<{ confirmed: boolean }>('POST', '/auth/customer/poll', { nonce });
      if (r.confirmed) {
        stopPoll();
        setPhase('code');
      }
    } catch {
      // 404 = muddati tugadi. Kutishni to'xtatamiz va sababni KO'RSATAMIZ —
      // jimgina aylanaversa foydalanuvchi nima bo'layotganini bilmaydi.
      stopPoll();
      setStart(null);
      setPhase('idle');
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
    <View style={[S.screen, { justifyContent: 'center', paddingTop: STATUS_PAD + SP.xl }]}>
      <TouchableOpacity
        onPress={onToggleLang}
        style={{ position: 'absolute', top: STATUS_PAD + SP.sm, right: SP.xl, padding: SP.sm }}
      >
        <Text style={{ color: C.accent, fontWeight: '700' }}>{t('lang_switch')}</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginBottom: SP.xxl }}>
        <MaterialIcons name="local-taxi" size={56} color={C.primary} />
        <Text style={[S.title, { marginTop: SP.md }]}>{t('login_title')}</Text>
        <Text style={[S.subtitle, { textAlign: 'center' }]}>{t('login_sub')}</Text>
      </View>

      {notice ? (
        <View style={[S.errBox, { marginBottom: SP.lg }]}>
          <Text style={{ color: C.accent, fontSize: F.label }}>{t(notice)}</Text>
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
          {phase === 'waiting' ? (
            <View style={[S.row, { justifyContent: 'center', gap: SP.sm }]}>
              <ActivityIndicator color={C.accent} />
              <Text style={{ color: C.text, fontSize: F.body }}>{t('login_waiting')}</Text>
            </View>
          ) : (
            <View style={[S.row, { justifyContent: 'center', gap: SP.sm }]}>
              <MaterialIcons name="check-circle" size={20} color={C.primary} />
              <Text style={{ color: C.primary, fontSize: F.body, fontWeight: '700' }}>
                {t('login_confirmed')}
              </Text>
            </View>
          )}

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
