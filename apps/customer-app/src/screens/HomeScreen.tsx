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
import { CategoryCard } from '../CategoryCard';
import { C, F, R, S, SP } from '../theme';
import { Dimensions, StyleSheet } from 'react-native';
import { Lang, makeT } from '../i18n';

type Category = 'standard' | 'comfort' | 'cargo';

interface Tariff {
  category: Category;
  baseFare: number;
}

/**
 * Toifa rasmi — maketdan olingan (assets/cars). Nomi va narxi KODDA EMAS:
 * nom tarjimadan, narx esa serverdagi tarifdan keladi.
 */
const CAR_IMAGE: Record<Category, ReturnType<typeof require>> = {
  standard: require('../../assets/cars/standart.png'),
  comfort: require('../../assets/cars/komfort.png'),
  cargo: require('../../assets/cars/yuk.png'),
};

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
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);
  // Maketdagi "1ta-4ta / 5+" tanlagichi. 5+ haydovchiga uzatiladi — u
  // mashinasiga hamma sig'ishini bilishi kerak.
  const [manyPax, setManyPax] = useState(false);
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

  // Narxlar SERVERDAN. Maketda ular qattiq yozilgan edi va admin tarifni
  // o'zgartirsa ilova eski narxni ko'rsatib mijozni chalg'itardi.
  useEffect(() => {
    (async () => {
      try {
        setTariffs(await api<Tariff[]>('GET', '/customer/tariffs', undefined, token));
      } catch {
        // Narxsiz ham buyurtma berish mumkin — kartada faqat nom qoladi.
      }
    })();
  }, [token]);

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
        { category, pickup, passengers: manyPax ? 5 : 4 },
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

  function confirmLogout() {
    Alert.alert(t('logout'), t('logout_confirm'), [
      { text: t('no'), style: 'cancel' },
      { text: t('yes'), style: 'destructive', onPress: onLogout },
    ]);
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
          ? [{ lat: view.driver.lat, lng: view.driver.lng, color: C.primary, label: t('taxi') }]
          : []),
      ] as MapMarker[])
    : [{ lat: pickup.lat, lng: pickup.lng, color: C.danger, label: t('you') }];

  // ---------- BUYURTMA REJIMI ----------
  if (!orderId) {
    const som = (n: number) => Math.round(n).toLocaleString('ru-RU');
    const fareOf = (c: Category) => tariffs?.find((x) => x.category === c)?.baseFare ?? null;
    const priceLabel = (c: Category) => {
      const f = fareOf(c);
      return f == null ? '' : `${som(f)} ${t('from_price')}`;
    };
    const selectedFare = fareOf(category);

    return (
      <View style={{ flex: 1, backgroundColor: C.mapBg }}>
        {/* Xarita BUTUN ekranni egallaydi, karta uning USTIDA turadi —
            maketdagi tartib. */}
        <View style={{ ...StyleSheet.absoluteFillObject }}>
          <MiniMap
            height={Dimensions.get('window').height}
            markers={markers}
            line={false}
            lang={lang}
          />
        </View>

        <View style={[S.topBar, { backgroundColor: 'rgba(255,255,255,0.94)' }]}>
          <View style={[S.row, { gap: SP.sm }]}>
            <MaterialIcons name="local-taxi" size={22} color={C.primary} />
            <Text style={S.brand}>{t('app_name')}</Text>
          </View>
          <View style={[S.row, { gap: SP.lg }]}>
            <TouchableOpacity onPress={onToggleLang} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: C.primary, fontWeight: '700' }}>{t('lang_switch')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: C.muted, fontWeight: '600' }}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={S.sheet}>
          {/* Yo'lovchilar soni */}
          <View style={[S.row, { justifyContent: 'space-between', marginBottom: SP.md }]}>
            <Text style={{ color: C.accent, fontSize: F.h3, fontWeight: '800' }}>
              {t('passengers')}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: C.accent,
                borderRadius: R.pill,
                padding: 4,
              }}
            >
              {[false, true].map((many) => (
                <TouchableOpacity
                  key={String(many)}
                  onPress={() => setManyPax(many)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: manyPax === many }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: SP.lg,
                    borderRadius: R.pill,
                    backgroundColor: manyPax === many ? C.bg : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: manyPax === many ? C.accent : C.onAccent,
                      fontWeight: '800',
                      fontSize: F.label,
                    }}
                  >
                    {t(many ? 'pax_many' : 'pax_few')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Toifalar */}
          <View style={[S.row, { gap: SP.sm, alignItems: 'stretch' }]}>
            {(['standard', 'comfort', 'cargo'] as Category[]).map((c) => (
              <CategoryCard
                key={c}
                image={CAR_IMAGE[c]}
                title={t('cat_' + (c === 'standard' ? 'standard' : c === 'comfort' ? 'comfort' : 'cargo'))}
                price={priceLabel(c)}
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>

          {manyPax ? (
            <Text style={{ color: C.muted, fontSize: F.tiny, marginTop: SP.sm }}>
              {t('pax_hint_many')}
            </Text>
          ) : null}

          {err ? <Text style={[S.err, { marginTop: SP.sm }]}>{err}</Text> : null}

          {/* Saqlangan manzil + asosiy tugma */}
          <View style={[S.row, { gap: SP.sm, marginTop: SP.md, alignItems: 'stretch' }]}>
            <TouchableOpacity
              style={[S.btnGhost, { width: 64 }]}
              onPress={() => Alert.alert(t('saved_home'), t('soon'))}
              accessibilityLabel={t('saved_home')}
            >
              <MaterialIcons name="home" size={24} color={C.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.btn, { flex: 1, flexDirection: 'column', paddingVertical: SP.sm }]}
              onPress={order}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={C.onPrimary} />
              ) : (
                <>
                  <Text style={{ color: C.onPrimary, fontSize: F.hero, fontWeight: '800' }}>
                    {t('call_taxi')}
                  </Text>
                  {/* Tugmadagi narx kartadagi bilan BIR XIL manbadan — maketda
                      ular turlicha edi (kartada 3 000, tugmada 4000). */}
                  {selectedFare != null ? (
                    <Text style={{ color: C.onPrimary, fontSize: F.small, opacity: 0.9 }}>
                      {t('cat_' + category)} — {som(selectedFare)} {t('from_price')}
                    </Text>
                  ) : null}
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
              backgroundColor: view?.driver ? C.primary : C.accent,
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
              <Text
                style={{
                  color: C.text,
                  fontWeight: '800',
                  marginTop: SP.sm,
                  alignSelf: 'flex-start',
                  paddingHorizontal: SP.md,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: R.sm,
                  letterSpacing: 1,
                }}
              >
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
            <Text style={{ color: C.primary, fontSize: F.hero, fontWeight: '800' }}>
              {som(view.finalPrice ?? 0)}{' '}
              <Text style={{ fontSize: F.title }}>{t('som')}</Text>
            </Text>

            {view.rated || rateSent ? (
              <Text style={{ color: C.primary, fontWeight: '700', marginTop: SP.lg }}>
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
