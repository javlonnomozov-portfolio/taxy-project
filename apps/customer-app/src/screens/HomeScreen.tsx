import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { MiniMap, MapMarker } from '../MapView';
import { C, F, R, S, SP } from '../theme';
import { Lang, makeT } from '../i18n';

type Category = 'standard' | 'comfort' | 'cargo';

interface TrackView {
  orderId: string;
  orderStatus: string;
  pickup: { lat: number; lng: number };
  driver: { lat: number; lng: number; at: string | null } | null;
  car: { name: string; plate: string; model: string; phone: string } | null;
  finished: boolean;
  finalPrice: number | null;
  completed: boolean;
  rated: boolean;
  cancellable: boolean;
}

const FALLBACK = { lat: 39.7683, lng: 67.2792 }; // xizmat hududi markazi
const som = (v: number) => Math.round(v).toLocaleString('ru-RU');

export function HomeScreen({
  lang,
  token,
  onToggleLang,
  onLogout,
}: {
  lang: Lang;
  token: string;
  onToggleLang: () => void;
  onLogout: () => void;
}) {
  const t = makeT(lang);
  const [pickup, setPickup] = useState(FALLBACK);
  const [category, setCategory] = useState<Category>('standard');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [view, setView] = useState<TrackView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rateSent, setRateSent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  // Joriy joylashuv — ruxsat bo'lsa. Bo'lmasa xizmat hududi markazidan
  // boshlaymiz: xarita baribir ishlaydi, foydalanuvchi pinni o'zi suradi.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* GPS yo'q — FALLBACK qoladi */
      }
    })();
  }, []);

  /** Faol zakazni tiklash — ilova yopilib qayta ochilsa ham safar yo'qolmasin. */
  const restore = useCallback(async () => {
    try {
      const a = await api<{ orderId: string | null }>('GET', '/customer/active', undefined, token);
      if (a.orderId) setOrderId(a.orderId);
    } catch {
      /* tarmoq yo'q — keyingi urinishda */
    }
  }, [token]);

  useEffect(() => {
    void restore();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void restore();
    });
    return () => sub.remove();
  }, [restore]);

  // Kuzatuv: zakaz bo'lsa har 5 soniyada holatni olamiz, tugagach to'xtaymiz.
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    const tick = async () => {
      try {
        const v = await api<TrackView>('GET', `/customer/orders/${orderId}`, undefined, token);
        if (!alive) return;
        setView(v);
        setErr(null);
        if (!v.finished) timer.current = setTimeout(tick, 5000);
      } catch (e) {
        if (!alive) return;
        // Xatoni KO'RSATAMIZ — jimgina yutilsa foydalanuvchi qotib qolgan
        // ekranga qarab o'tiraveradi.
        setErr((e as Error).message || t('err_network'));
        timer.current = setTimeout(tick, 8000);
      }
    };
    void tick();
    return () => {
      alive = false;
      stop();
    };
  }, [orderId, token, stop, t]);

  async function order() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ orderId: string }>(
        'POST',
        '/customer/orders',
        { category, pickup },
        token,
      );
      setOrderId(r.orderId);
      setRateSent(false);
    } catch (e) {
      setErr((e as Error).message || t('err'));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (!orderId || !view) return;
    const msg = view.car ? t('cancel_confirm_penalty') : t('cancel_confirm');
    Alert.alert(t('cancel_btn'), msg, [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await api<{ penalized: boolean }>(
              'POST',
              `/customer/orders/${orderId}/cancel`,
              {},
              token,
            );
            Alert.alert(
              t('cancelled'),
              r.penalized ? t('cancelled_penalty') : t('cancelled_free'),
            );
          } catch (e) {
            Alert.alert(t('err'), (e as Error).message);
          }
        },
      },
    ]);
  }

  async function rate(score: number) {
    if (!orderId) return;
    setRateSent(true);
    try {
      await api('POST', `/customer/orders/${orderId}/rate`, { score }, token);
    } catch {
      setRateSent(false);
    }
  }

  function reset() {
    stop();
    setOrderId(null);
    setView(null);
    setRateSent(false);
  }

  const statusText = (st: string) =>
    st === 'ARRIVED'
      ? t('arrived')
      : st === 'IN_PROGRESS'
        ? t('in_progress')
        : st === 'ACCEPTED' || st === 'CONFIRMED' || st === 'ARRIVING'
          ? t('on_the_way')
          : t('searching');

  const markers: MapMarker[] = view
    ? ([
        { lat: view.pickup.lat, lng: view.pickup.lng, color: C.danger, label: t('you') },
        ...(view.driver
          ? [{ lat: view.driver.lat, lng: view.driver.lng, color: C.online, label: t('taxi') }]
          : []),
      ] as MapMarker[])
    : [{ lat: pickup.lat, lng: pickup.lng, color: C.danger, label: t('you') }];

  // ---------- BUYURTMA REJIMI ----------
  if (!orderId) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={S.topBar}>
          <View style={[S.row, { gap: SP.sm }]}>
            <MaterialIcons name="local-taxi" size={22} color={C.accent} />
            <Text style={S.brand}>{t('app_name')}</Text>
          </View>
          <TouchableOpacity onPress={onToggleLang}>
            <Text style={{ color: C.accent, fontWeight: '700' }}>{t('lang_switch')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SP.xl }}>
          <Text style={S.title}>{t('where_from')}</Text>
          <Text style={S.subtitle}>{t('move_map')}</Text>

          <View style={{ borderRadius: R.lg, overflow: 'hidden' }}>
            <MiniMap height={280} markers={markers} line={false} lang={lang} />
          </View>

          <View style={[S.row, { gap: SP.sm, marginTop: SP.lg }]}>
            {(['standard', 'comfort', 'cargo'] as Category[]).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  S.btnGhost,
                  { flex: 1 },
                  category === c && { borderColor: C.accent, backgroundColor: C.accentSoft },
                ]}
              >
                <Text style={[S.btnGhostText, category === c && { color: C.text }]}>
                  {t('cat_' + c)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {err ? <Text style={[S.err, { marginTop: SP.md }]}>{err}</Text> : null}

          <TouchableOpacity
            style={[S.btn, S.btnOk, { marginTop: SP.lg }]}
            onPress={order}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={C.onOk} />
            ) : (
              <Text style={S.btnOkText}>{t('order_btn')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onLogout} style={{ alignItems: 'center', paddingVertical: SP.lg }}>
            <Text style={{ color: C.muted }}>⎋</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ---------- KUZATUV REJIMI ----------
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={S.topBar}>
        <View style={[S.row, { gap: SP.sm }]}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: view?.driver ? C.online : C.warn,
            }}
          />
          <Text style={S.brand}>
            {view ? (view.finished ? t(view.completed ? 'finished' : 'cancelled') : statusText(view.orderStatus)) : t('searching')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.xl }}>
        <View style={{ borderRadius: R.lg, overflow: 'hidden' }}>
          <MiniMap height={280} markers={markers} lang={lang} />
        </View>

        {err ? <Text style={[S.err, { marginTop: SP.md }]}>{err}</Text> : null}

        {view?.car ? (
          <View style={[S.card, { marginTop: SP.lg }]}>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>
              {view.car.name}
            </Text>
            {view.car.model ? (
              <Text style={{ color: C.muted, marginTop: 2 }}>{view.car.model}</Text>
            ) : null}
            {view.car.plate ? (
              <Text style={[S.pill, { color: C.text, fontWeight: '800', marginTop: SP.sm, alignSelf: 'flex-start', paddingHorizontal: SP.md, paddingVertical: 4, borderColor: C.border }]}>
                {view.car.plate}
              </Text>
            ) : null}
            {view.car.phone && !view.finished ? (
              <TouchableOpacity
                style={[S.btn, { marginTop: SP.md }]}
                onPress={() => Linking.openURL('tel:' + view.car!.phone)}
              >
                <MaterialIcons name="phone" size={20} color="#fff" />
                <Text style={[S.btnText, { marginLeft: 6 }]}>{view.car.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {view?.finished && view.completed ? (
          <View style={{ marginTop: SP.lg, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: F.label }}>{t('price')}</Text>
            <Text style={{ color: C.online, fontSize: F.hero, fontWeight: '800' }}>
              {som(view.finalPrice ?? 0)}{' '}
              <Text style={{ fontSize: F.h2 }}>{t('som')}</Text>
            </Text>

            {view.rated || rateSent ? (
              <Text style={{ color: C.online, fontWeight: '700', marginTop: SP.lg }}>
                {t('thanks_rating')}
              </Text>
            ) : (
              <>
                <Text style={[S.label, { marginTop: SP.lg }]}>{t('rate_prompt')}</Text>
                <View style={[S.row, { gap: SP.sm, marginTop: SP.sm }]}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} style={[S.btnGhost, { flex: 1 }]} onPress={() => rate(n)}>
                      <Text style={S.btnGhostText}>{n}⭐</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        ) : null}

        {view?.cancellable ? (
          <TouchableOpacity
            style={[S.btnGhost, { marginTop: SP.lg, borderColor: C.danger }]}
            onPress={cancel}
          >
            <Text style={[S.btnGhostText, { color: C.danger }]}>{t('cancel_btn')}</Text>
          </TouchableOpacity>
        ) : null}

        {view?.finished ? (
          <TouchableOpacity style={[S.btn, { marginTop: SP.lg }]} onPress={reset}>
            <Text style={S.btnText}>{t('new_order')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}
