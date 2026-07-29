import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Socket } from 'socket.io-client';
import { connectDriver, EV, SocketAck } from '../socket';
import { api } from '../api';
import { registerForPush, notifyOffer } from '../push';
import { startBackgroundLocation, stopBackgroundLocation } from '../location-task';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { S, C, R, F, SP } from '../theme';
import { Lang, makeT } from '../i18n';
import { MiniMap, MapMarker } from '../MapView';
import { CabinetScreen } from './CabinetScreen';

interface LatLng { lat: number; lng: number }
interface Offer {
  orderId: string;
  pickup: LatLng;
  pickupAddress?: string;
  dest?: LatLng;
  destAddress?: string;
  distanceM: number;
  note?: string;
  timeoutSec?: number;
  customer: { phone: string; name?: string };
}
type PendingOffer = Offer & { expiresAt: number };
interface MeterConfig {
  baseFare: number;
  perKm: number;
  waitingPerMin: number;
}
type Stage = 'accepted' | 'arrived' | 'in_progress';
interface Trip {
  orderId: string;
  pickup: LatLng;
  pickupAddress?: string;
  dest?: LatLng;
  destAddress?: string;
  customer: { phone: string; name?: string };
  meter: MeterConfig;
  stage: Stage;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const EARTH_R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

/** Kabinet API'sidan kerak bo'ladigan minimal maydonlar (daromad hisobi uchun). */
interface FinishedTrip {
  status: string;
  finalPrice: number | null;
  completedAt: string | null;
}

const som = (v: number) => Math.round(v).toLocaleString('ru-RU');

/**
 * Bugungi daromad ilovaning O'ZIDA hisoblanadi — API'da bunday endpoint yo'q.
 * `/drivers/me/trips` oxirgi 50 safarni `completedAt` bo'yicha kamayish tartibida
 * qaytaradi, ya'ni bugungilar doim ro'yxat boshida — 50 chegarasi hisobni kesmaydi.
 */
function todayEarned(trips: FinishedTrip[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return trips.reduce((sum, tr) => {
    if (tr.status !== 'COMPLETED' || !tr.completedAt || tr.finalPrice == null) return sum;
    return new Date(tr.completedAt) >= start ? sum + Number(tr.finalPrice) : sum;
  }, 0);
}

export function HomeScreen({
  lang,
  token,
  onLogout,
}: {
  lang: Lang;
  token: string;
  onLogout: () => void;
}) {
  const t = makeT(lang);
  const [intent, setIntent] = useState(false); // haydovchi ishlashni xohlaydi (tugma bosilgan)
  const [online, setOnline] = useState(false); // backend TASDIQLAGAN holat (ack + ulanish)
  const [offers, setOffers] = useState<PendingOffer[]>([]); // kutilayotgan takliflar ro'yxati
  const [expandedId, setExpandedId] = useState<string | null>(null); // xaritasi ochilgan taklif
  const [, setTick] = useState(0); // countdown uchun qayta render
  const [trip, setTrip] = useState<Trip | null>(null);
  const [distanceM, setDistanceM] = useState(0);
  const [done, setDone] = useState<{ price: number } | null>(null);
  const [showCabinet, setShowCabinet] = useState(false);
  // Ulanish/ro'yxatdan o'tish xatosi — avval JIMGINA yutilardi va haydovchi
  // sababsiz "Ulanmoqda…" holatida qolardi.
  const [connError, setConnError] = useState<string | null>(null);
  // Yuqoridagi ko'rsatkichlar (bugungi/umumiy daromad, reyting).
  const [earn, setEarn] = useState<{ today: number; total: number; rating: number } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastLoc = useRef<{ lat: number; lng: number } | null>(null);
  const tripRef = useRef<Trip | null>(null);
  tripRef.current = trip;
  const wantOnlineRef = useRef(false); // socket handlerlari uchun "onlayn bo'lishni xohlayapti"
  const registerOnlineRef = useRef<() => void>(() => {});
  const offersRef = useRef<PendingOffer[]>([]);
  offersRef.current = offers;

  const upsertOffer = (o: Offer) => {
    const expiresAt = Date.now() + (o.timeoutSec ?? 120) * 1000;
    setOffers((cur) =>
      cur.some((x) => x.orderId === o.orderId)
        ? cur.map((x) => (x.orderId === o.orderId ? { ...o, expiresAt } : x))
        : [...cur, { ...o, expiresAt }],
    );
  };
  const removeOffer = (orderId: string) =>
    setOffers((cur) => cur.filter((x) => x.orderId !== orderId));

  // Kutilayotgan takliflarni backend'dan olamiz (bildirishnoma bosilganda / fondan qaytganda).
  const fetchPending = async () => {
    if (tripRef.current) return;
    try {
      const list = await api<Offer[]>('GET', '/offers/pending', undefined, token);
      setOffers(list.map((o) => ({ ...o, expiresAt: Date.now() + (o.timeoutSec ?? 120) * 1000 })));
    } catch {
      /* ignore */
    }
  };

  const fetchEarnings = async () => {
    try {
      const [trips, stats] = await Promise.all([
        api<FinishedTrip[]>('GET', '/drivers/me/trips', undefined, token),
        api<{ earnedTotal: number; ratingAvg: number }>(
          'GET',
          '/drivers/me/stats',
          undefined,
          token,
        ),
      ]);
      setEarn({
        today: todayEarned(trips),
        total: Number(stats.earnedTotal ?? 0),
        rating: Number(stats.ratingAvg ?? 0),
      });
    } catch {
      /* ko'rsatkichlar ikkinchi darajali — xato ekranni bloklamasin */
    }
  };

  // Socket ulanish
  useEffect(() => {
    const s = connectDriver(token);
    socketRef.current = s;
    // Backend'ga "onlayn" yuborish — faqat ACK (ok) kelganda UI onlayn bo'ladi.
    const registerOnline = () =>
      s.emit(EV.online, {}, (ack?: SocketAck) => {
        if (ack?.ok) {
          setOnline(true);
          setConnError(null);
        } else {
          // Server rad etdi (masalan hisob tasdiqlanmagan) — sababni ko'rsatamiz.
          setConnError(ack?.message ?? t('error_generic'));
        }
      });
    registerOnlineRef.current = registerOnline;
    // Ulanish/qayta ulanish: agar haydovchi ishlashni xohlasa — qayta ro'yxatdan o'tamiz.
    s.on('connect', () => {
      setConnError(null);
      if (wantOnlineRef.current) {
        registerOnline();
        // Uzilish davomida server bizni dispatch indeksidan chiqarib yuborgan bo'lishi
        // mumkin — joylashuvni darhol qaytaramiz, taklif olish uchun shu shart.
        if (lastLoc.current) s.emit(EV.location, lastLoc.current);
      }
    });
    // Ulanib bo'lmasa sababni ko'rsatamiz (tarmoq, proksi, token va h.k.).
    s.on('connect_error', (e: Error) => setConnError(e.message || 'connect_error'));
    // Uzilish: backend grace'dan keyin oflayn qiladi — UI'da halol ko'rsatamiz ("Ulanmoqda…").
    s.on('disconnect', (reason: string) => {
      setOnline(false);
      setConnError(reason);
    });
    s.on(EV.orderOffer, (o: Offer) => {
      if (tripRef.current) return; // safarda — yangi taklif qo'shmaymiz
      upsertOffer(o);
      // Fon rejimida ham diqqatni tortish uchun ovozli bildirishnoma.
      void notifyOffer((o.distanceM / 1000).toFixed(1));
    });
    s.on(EV.orderOfferCancelled, (o: { orderId: string }) => removeOffer(o.orderId));
    s.on(
      EV.orderAssigned,
      (a: {
        orderId: string;
        customer: Offer['customer'];
        meterConfig: MeterConfig;
        pickup?: LatLng;
        pickupAddress?: string;
        dest?: LatLng;
        destAddress?: string;
      }) => {
        const accepted = offersRef.current.find((x) => x.orderId === a.orderId);
        setTrip({
          orderId: a.orderId,
          pickup: a.pickup ?? accepted?.pickup ?? { lat: 0, lng: 0 },
          pickupAddress: a.pickupAddress ?? accepted?.pickupAddress,
          dest: a.dest ?? accepted?.dest,
          destAddress: a.destAddress ?? accepted?.destAddress,
          customer: a.customer,
          meter: a.meterConfig,
          stage: 'accepted',
        });
        setOffers([]);
        setDistanceM(0);
      },
    );
    // Qayta ulanганda kutilayotgan takliflarni yangilaymiz.
    s.on('connect', () => void fetchPending());
    // Safar mijoz/operator tomonidan bekor qilindi — ekranni yopib, yana buyurtma qabul qilamiz.
    s.on(EV.tripEnded, (e: { orderId: string; reason?: string }) => {
      removeOffer(e.orderId);
      if (tripRef.current && tripRef.current.orderId === e.orderId) {
        setTrip(null);
        setDistanceM(0);
        Alert.alert(t('trip_cancelled_title'), t('trip_cancelled_msg'));
      }
    });
    // Push tokenini ro'yxatga olish (dev-build kerak)
    (async () => {
      const expoToken = await registerForPush();
      if (expoToken) {
        try {
          await api('POST', '/drivers/push-token', { token: expoToken }, token);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      s.close();
      socketRef.current = null;
    };
  }, [token]);

  // Joylashuv "yurak urishi". Server haydovchini dispatch indeksida faqat joylashuv
  // yangilanishi kelganda ushlab turadi, `watchPositionAsync` esa turgan telefonda
  // jim qolishi mumkin. Shuning uchun onlayn ekanmiz — har daqiqada oxirgi ma'lum
  // nuqtani qayta yuboramiz (uzilib-ulanganda ham indeks tiklanadi).
  useEffect(() => {
    if (!intent) return;
    const id = setInterval(() => {
      if (lastLoc.current) socketRef.current?.emit(EV.location, lastLoc.current);
      else void sendCurrentPosition();
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  // Har soniyada: countdown yangilanadi va muddati tugagan takliflar ro'yxatdan chiqadi.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
      setOffers((cur) => cur.filter((o) => o.expiresAt > Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fondan qaytganda va bildirishnoma bosilganda kutilayotgan takliflarni yangilaymiz.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        void fetchPending();
        void fetchEarnings();
      }
    });
    const nsub = Notifications.addNotificationResponseReceivedListener(() => void fetchPending());
    void fetchPending();
    void fetchEarnings();
    return () => {
      sub.remove();
      nsub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goOnline() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ruxsat', 'Joylashuv ruxsati kerak.');
      return;
    }
    wantOnlineRef.current = true;
    setIntent(true);
    // Backend'ga ro'yxatdan o'tamiz — ACK kelganda UI onlayn bo'ladi (registerOnline).
    registerOnlineRef.current();
    if (!watchRef.current) {
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 15 },
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          socketRef.current?.emit(EV.location, loc);
          if (tripRef.current?.stage === 'in_progress' && lastLoc.current) {
            setDistanceM((d) => d + haversine(lastLoc.current!, loc));
          }
          lastLoc.current = loc;
        },
      );
    }
    // Server dispatch uchun joylashuvsiz haydovchini KO'RMAYDI, `watchPositionAsync` esa
    // `distanceInterval` sababli telefon qimirlamaguncha hech narsa bermasligi mumkin —
    // shuning uchun darhol bitta nuqta olib yuboramiz. Busiz haydovchi "Onlayn" turib,
    // hech qachon taklif olmasligi mumkin edi.
    void sendCurrentPosition();
    // Fon rejimida ham joylashuv (ilova yopiq bo'lsa HTTP orqali)
    void startBackgroundLocation();
  }

  /** Hozirgi joylashuvni bir marta olib serverga yuborish (indeksni tirik ushlash uchun). */
  async function sendCurrentPosition(): Promise<void> {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      lastLoc.current = loc;
      socketRef.current?.emit(EV.location, loc);
    } catch {
      /* GPS hozir yo'q — keyingi urinishda */
    }
  }

  function goOffline() {
    wantOnlineRef.current = false;
    setIntent(false);
    socketRef.current?.emit(EV.offline, {});
    watchRef.current?.remove();
    watchRef.current = null;
    void stopBackgroundLocation();
    setOnline(false);
  }

  function respond(orderId: string, accept: boolean) {
    socketRef.current?.emit(EV.offerResponse, { orderId, accept });
    // Rad etilsa darhol ro'yxatdan olib tashlaymiz; qabul qilinsa serverdan
    // order:assigned (yoki boshqasi yutsa order:offer_cancelled) kutamiz.
    if (!accept) removeOffer(orderId);
  }

  function tripAction(ev: string, nextStage?: Stage) {
    if (!trip) return;
    // Server javobini KUTAMIZ: avval bosqichni darhol surardik va server rad etsa
    // ilova bilan server holati bir-biriga to'g'ri kelmay qolardi.
    socketRef.current?.emit(ev, { orderId: trip.orderId }, (ack?: SocketAck) => {
      if (ack && ack.ok === false) {
        Alert.alert(t('error'), ack.message ?? t('error_generic'));
        return;
      }
      if (nextStage) setTrip((cur) => (cur ? { ...cur, stage: nextStage } : cur));
    });
  }

  function complete() {
    if (!trip) return;
    socketRef.current?.emit(
      EV.tripComplete,
      { orderId: trip.orderId, distanceM: Math.round(distanceM) },
      (resp?: SocketAck & { finalPrice?: number }) => {
        // Xatoda "0 so'm" ekranini ko'rsatmaymiz — safar hali tugamagan.
        if (resp && resp.ok === false) {
          Alert.alert(t('error'), resp.message ?? t('error_generic'));
          return;
        }
        setDone({ price: resp?.finalPrice ?? 0 });
        setTrip(null);
        void fetchEarnings(); // bugungi daromad darhol yangilansin
      },
    );
  }

  function sendSos() {
    Alert.alert(t('sos_confirm_title'), t('sos_confirm_msg'), [
      { text: t('cancel_trip'), style: 'cancel' },
      {
        text: t('sos'),
        style: 'destructive',
        onPress: () => {
          socketRef.current?.emit(EV.sos, { orderId: trip?.orderId }, (ack?: SocketAck) => {
            if (ack && ack.ok === false) {
              Alert.alert(t('error'), ack.message ?? t('error_generic'));
              return;
            }
            Alert.alert(t('sos'), t('sos_sent'));
          });
        },
      },
    ]);
  }

  /**
   * Safarni bekor qilish.
   *
   * Uchta muammo tuzatildi (haydovchilar "yakunlagan safarim bekor qilingan
   * deb turibdi" deb shikoyat qilgan edi):
   *  1. TASDIQ so'ralmasdi — bitta tasodifiy teginish haqiqiy safarni bekor
   *     qilardi va haydovchi buni sezmasdi ham.
   *  2. Server javobi TEKSHIRILMASDI (ack callback yo'q edi) — server rad etsa
   *     ham ilova safar ekranini yopardi. Haydovchi safar tugadi deb o'ylardi,
   *     serverda esa zakaz hali faol qolardi.
   *  3. `setTrip(null)` server javobidan OLDIN chaqirilardi.
   */
  function cancelTrip() {
    if (!trip) return;
    Alert.alert(t('cancel_trip_title'), t('cancel_trip_confirm'), [
      { text: t('cancel_trip_no'), style: 'cancel' },
      {
        text: t('cancel_trip_yes'),
        style: 'destructive',
        onPress: () => {
          const orderId = trip.orderId;
          socketRef.current?.emit(EV.tripCancel, { orderId }, (ack?: SocketAck) => {
            if (ack && ack.ok === false) {
              Alert.alert(t('error'), ack.message ?? t('error_generic'));
              return; // safar ekrani OCHIQ qoladi — server holati bilan mos
            }
            setTrip(null);
            setDistanceM(0);
          });
        },
      },
    ]);
  }

  const navigate = (p: { lat: number; lng: number }) =>
    Linking.openURL(`https://yandex.uz/maps/?rtext=~${p.lat},${p.lng}&rtt=auto`);
  const call = (phone: string) => Linking.openURL('tel:' + phone);

  if (showCabinet) {
    return <CabinetScreen lang={lang} token={token} onClose={() => setShowCabinet(false)} />;
  }

  // Yakuniy narx ekrani — kuniga 20+ marta ko'riladi, shuning uchun bayramona
  // emas, tinch: bitta katta son va bitta tugma.
  if (done) {
    return (
      <View style={[S.screen, S.center, { alignItems: 'center' }]}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: R.pill,
            backgroundColor: C.okSoft,
            borderWidth: 2,
            borderColor: C.online,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="check" size={44} color={C.online} />
        </View>
        <Text
          style={{ color: C.text, fontSize: F.title, fontWeight: '700', marginTop: SP.xl }}
        >
          {t('trip_done')}
        </Text>
        <Text
          style={{
            color: C.online,
            fontSize: F.hero,
            fontWeight: '800',
            marginTop: SP.md,
            textAlign: 'center',
          }}
        >
          {som(done.price)} <Text style={{ fontSize: F.h2 }}>{t('som')}</Text>
        </Text>
        <TouchableOpacity
          style={[S.btn, { alignSelf: 'stretch', marginTop: SP.xxl * 2 }]}
          onPress={() => setDone(null)}
        >
          <Text style={S.btnText}>OK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Safar paneli
  if (trip) {
    const liveMeter =
      trip.meter.baseFare + (trip.meter.perKm * distanceM) / 1000;
    const goingToCustomer = trip.stage !== 'in_progress';
    const me = lastLoc.current
      ? [{ lat: lastLoc.current.lat, lng: lastLoc.current.lng, color: '#3ddc84', label: t('online') }]
      : [];
    const tripMarkers: MapMarker[] = goingToCustomer
      ? [{ lat: trip.pickup.lat, lng: trip.pickup.lng, color: '#ff4d4f', label: t('customer') }, ...me]
      : [
          ...me,
          trip.dest
            ? { lat: trip.dest.lat, lng: trip.dest.lng, color: '#4c8dff', label: t('destination') }
            : { lat: trip.pickup.lat, lng: trip.pickup.lng, color: '#ff4d4f', label: t('customer') },
        ];
    const navTarget = !goingToCustomer && trip.dest ? trip.dest : trip.pickup;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={S.topBar}>
          <View style={[S.row, { gap: SP.sm }]}>
            <MaterialIcons name="local-taxi" size={22} color={C.accent} />
            <Text style={S.brand}>
              {trip.stage === 'in_progress' ? t('on_trip') : t('to_customer')}
            </Text>
          </View>
          <View
            style={[
              S.pill,
              { borderColor: C.online, backgroundColor: C.okSoft },
            ]}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.online }} />
            <Text style={{ color: C.online, fontSize: F.tiny, fontWeight: '800' }}>
              {t('online').toUpperCase()}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.xxl }}>
          {/* Mijoz: ism + TELEFON. Telefon shart — haydovchi shu yerdan qo'ng'iroq qiladi. */}
          <View style={[S.card, { padding: SP.lg }]}>
            <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 0.6 }}>
              {t('customer').toUpperCase()}
            </Text>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '800', marginTop: 2 }}>
              {trip.customer.name || '—'}
            </Text>
            <TouchableOpacity
              style={[S.row, { gap: 6, marginTop: SP.sm }]}
              onPress={() => call(trip.customer.phone)}
            >
              <MaterialIcons name="phone" size={16} color={C.accent} />
              <Text style={{ color: C.accent, fontSize: F.body, fontWeight: '600' }}>
                {trip.customer.phone}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Taksometr — safarda ekrandagi ENG KATTA element (qo'l uzunligidan o'qilsin). */}
          {trip.stage === 'in_progress' && (
            <View
              style={[
                S.card,
                { marginTop: SP.md, alignItems: 'center', paddingVertical: SP.xl },
              ]}
            >
              <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 1.2 }}>
                {t('meter').toUpperCase()}
              </Text>
              <Text
                style={{
                  color: C.online,
                  fontSize: F.hero,
                  fontWeight: '800',
                  marginTop: SP.xs,
                }}
              >
                {som(liveMeter)} <Text style={{ fontSize: F.h2 }}>{t('som')}</Text>
              </Text>
              <View
                style={[
                  S.row,
                  {
                    gap: 6,
                    marginTop: SP.md,
                    backgroundColor: C.panel2,
                    borderRadius: R.pill,
                    paddingHorizontal: SP.md,
                    paddingVertical: 6,
                  },
                ]}
              >
                <MaterialIcons name="place" size={14} color={C.muted} />
                <Text style={{ color: C.text, fontSize: F.label, fontWeight: '600' }}>
                  {(distanceM / 1000).toFixed(1)} {t('km')}
                </Text>
              </View>
            </View>
          )}

          <View style={{ marginTop: SP.md, borderRadius: R.lg, overflow: 'hidden' }}>
            <MiniMap height={220} markers={tripMarkers} />
          </View>

          <View style={[S.row, { gap: SP.md, marginTop: SP.md }]}>
            <TouchableOpacity style={[S.btnGhost, { flex: 1 }]} onPress={() => navigate(navTarget)}>
              <View style={[S.row, { gap: 6 }]}>
                <MaterialIcons name="navigation" size={18} color={C.text} />
                <Text style={S.btnGhostText}>{t('navigate')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btnGhost, { flex: 1 }]}
              onPress={() => call(trip.customer.phone)}
            >
              <View style={[S.row, { gap: 6 }]}>
                <MaterialIcons name="phone" size={18} color={C.online} />
                <Text style={S.btnGhostText}>{t('call')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bosqich tugmasi — har bosqichda BITTA, doim shu joyda. */}
          <View style={{ marginTop: SP.lg }}>
            {trip.stage === 'accepted' && (
              <TouchableOpacity style={S.btn} onPress={() => tripAction(EV.tripArrived, 'arrived')}>
                <MaterialIcons name="where-to-vote" size={22} color="#FFFFFF" />
                <Text style={[S.btnText, { marginLeft: 6 }]}>{t('arrived')}</Text>
              </TouchableOpacity>
            )}
            {trip.stage === 'arrived' && (
              <TouchableOpacity
                style={[S.btn, S.btnOk]}
                onPress={() => tripAction(EV.tripStart, 'in_progress')}
              >
                <MaterialIcons name="play-arrow" size={22} color={C.onOk} />
                <Text style={[S.btnOkText, { marginLeft: 6 }]}>{t('start_trip')}</Text>
              </TouchableOpacity>
            )}
            {trip.stage === 'in_progress' && (
              <TouchableOpacity style={[S.btn, S.btnOk]} onPress={complete}>
                <MaterialIcons name="check-circle-outline" size={22} color={C.onOk} />
                <Text style={[S.btnOkText, { marginLeft: 6 }]}>{t('finish_trip')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Xavfli amallar asosiy oqimdan CHIZIQ bilan ajratilgan — safar
              tugatish tugmasining yonida turmasin. */}
          <View
            style={{ height: 1, backgroundColor: C.border, marginVertical: SP.xl }}
          />

          {/* Safar BOSHLANGACH bekor qilib bo'lmaydi — server `IN_PROGRESS` dan
              bekor qilishga ruxsat bermaydi. Tugmani ko'rsatib turish tuzoq edi:
              bosilardi, server rad etardi, xato yutilardi va safar ekrani
              yopilardi. Endi bu bosqichda chiqish faqat "Safarni yakunlash". */}
          {trip.stage !== 'in_progress' && (
            <TouchableOpacity onPress={cancelTrip} style={{ alignItems: 'center', paddingVertical: SP.md }}>
              <Text style={{ color: C.danger, fontSize: 15, fontWeight: '600' }}>
                {t('cancel_trip_btn')}
              </Text>
            </TouchableOpacity>
          )}

          {/* SOS — doim qo'l ostida, lekin tasodifan bosilmasin: kichik,
              markazda, ramkali va tasdiq so'raydi (sendSos). */}
          <TouchableOpacity
            style={[
              S.row,
              {
                alignSelf: 'center',
                gap: SP.sm,
                marginTop: SP.sm,
                borderWidth: 1.5,
                borderColor: C.danger,
                borderRadius: R.pill,
                paddingHorizontal: SP.xxl,
                paddingVertical: SP.md,
              },
            ]}
            onPress={sendSos}
          >
            <MaterialIcons name="emergency" size={18} color={C.danger} />
            <Text style={{ color: C.danger, fontSize: F.body, fontWeight: '800', letterSpacing: 1 }}>
              {t('sos')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Asosiy: onlayn/oflayn + takliflar ro'yxati
  const state: 'online' | 'connecting' | 'offline' = online
    ? 'online'
    : intent
      ? 'connecting'
      : 'offline';
  const stateColor = { online: C.online, connecting: C.warn, offline: C.muted }[state];
  const stateIcon = { online: 'wifi', connecting: 'sync', offline: 'wifi-off' }[state] as
    keyof typeof MaterialIcons.glyphMap;
  const stateSub = {
    online: t('waiting_orders'),
    connecting: t('network_check'),
    offline: t('go_online_hint'),
  }[state];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={S.topBar}>
        <View style={[S.row, { gap: SP.sm }]}>
          <MaterialIcons name="local-taxi" size={22} color={C.accent} />
          <Text style={S.brand}>Toy TaxY</Text>
        </View>
        <View style={[S.row, { gap: SP.xl }]}>
          <TouchableOpacity onPress={() => setShowCabinet(true)} hitSlop={10}>
            <Text style={{ color: C.accent, fontSize: 15, fontWeight: '700' }}>{t('cabinet')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} hitSlop={10}>
            <Text style={{ color: C.muted, fontSize: 15 }}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.xxl }}>
        {/* Ko'rsatkichlar: bugungi daromad KATTA, umumiy va reyting kichik yonida. */}
        <View style={[S.row, { gap: SP.md, marginBottom: SP.lg }]}>
          <View style={[S.card, { flex: 2, padding: SP.lg }]}>
            <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 0.6 }}>
              {t('today_earned').toUpperCase()}
            </Text>
            <Text style={{ color: C.text, fontSize: F.title, fontWeight: '800', marginTop: 2 }}>
              {som(earn?.today ?? 0)} <Text style={{ fontSize: F.body }}>{t('som')}</Text>
            </Text>
            <Text style={{ color: C.muted, fontSize: F.tiny, marginTop: 4 }}>
              {t('total_earned_short')}: {som(earn?.total ?? 0)} {t('som')}
            </Text>
          </View>
          <View style={[S.card, { flex: 1, padding: SP.lg }]}>
            <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 0.6 }}>
              {t('rating').toUpperCase()}
            </Text>
            <View style={[S.row, { gap: 4, marginTop: 2 }]}>
              <Text style={{ color: C.gold, fontSize: F.h2, fontWeight: '800' }}>
                {(earn?.rating ?? 0).toFixed(2)}
              </Text>
              <MaterialIcons name="star" size={18} color={C.gold} />
            </View>
          </View>
        </View>

        {/* Holat kartasi — 1 metrdan ko'rinishi kerak, shuning uchun rang butun kartada. */}
        <View
          style={[
            S.card,
            {
              alignItems: 'center',
              paddingVertical: SP.xxl + 4,
              borderColor: stateColor,
              backgroundColor: state === 'online' ? C.okSoft : C.panel,
            },
          ]}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: R.pill,
              borderWidth: 2,
              borderColor: stateColor,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: SP.lg,
            }}
          >
            <MaterialIcons name={stateIcon} size={34} color={stateColor} />
          </View>
          <View style={[S.row, { gap: SP.sm }]}>
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: stateColor }}
            />
            <Text style={{ color: stateColor, fontSize: F.title, fontWeight: '800' }}>
              {online ? t('online') : intent ? t('connecting') : t('offline')}
            </Text>
          </View>
          <Text
            style={{
              color: C.muted,
              fontSize: 15,
              marginTop: SP.sm,
              textAlign: 'center',
              paddingHorizontal: SP.lg,
            }}
          >
            {stateSub}
          </Text>

          {/* Onlayn, lekin GPS nuqtasi hali yo'q — dispatch bizni shu sababdan
              ko'rmasligi mumkin, shuning uchun holatni ochiq aytamiz. */}
          {online && !lastLoc.current && (
            <View style={[S.row, { gap: 6, marginTop: SP.md }]}>
              <MaterialIcons name="gps-not-fixed" size={16} color={C.warn} />
              <Text style={{ color: C.warn, fontSize: F.label }}>{t('gps_searching')}</Text>
            </View>
          )}

          {/* Ulanish xatosi — DIAGNOSTIKA UCHUN SHART. Yashirmang: aynan shu qator
              "Ulanmoqda…" muammosining sababini topishga imkon bergan. */}
          {!online && connError && (
            <View style={{ marginTop: SP.lg, width: '100%', paddingHorizontal: SP.lg }}>
              <View style={[S.errBox, S.row, { gap: SP.sm }]}>
                <MaterialIcons name="error-outline" size={16} color={C.danger} />
                <Text style={{ color: C.danger, fontSize: F.label, flex: 1 }}>{connError}</Text>
              </View>
              {intent && (
                <Text
                  style={{
                    color: C.muted,
                    fontSize: F.tiny,
                    fontStyle: 'italic',
                    textAlign: 'center',
                    marginTop: 6,
                  }}
                >
                  {t('reconnecting')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Eng muhim tugma — doim ko'rinadi va doim bir joyda. */}
        <View style={{ marginTop: SP.lg }}>
          {intent ? (
            <TouchableOpacity style={[S.btn, S.btnDanger]} onPress={goOffline}>
              <Text style={S.btnText}>{t('go_offline')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[S.btn, S.btnOk]} onPress={goOnline}>
              <MaterialIcons name="play-arrow" size={22} color={C.onOk} />
              <Text style={[S.btnOkText, { marginLeft: 6 }]}>{t('go_online')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kutilayotgan takliflar RO'YXATI */}
        {offers.length > 0 && (
          <View style={{ marginTop: SP.xxl }}>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700', marginBottom: SP.md }}>
              {t('new_orders')} ({offers.length})
            </Text>
            {offers.map((o) => {
              const remaining = Math.max(0, Math.ceil((o.expiresAt - Date.now()) / 1000));
              const urgent = remaining <= 20;
              const expanded = expandedId === o.orderId;
              const total = o.timeoutSec ?? 120;
              return (
                <View
                  key={o.orderId}
                  style={[S.card, { marginBottom: SP.md, padding: SP.lg, borderColor: C.border }]}
                >
                  <View style={[S.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                    <View>
                      <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 0.6 }}>
                        {t('distance_away').toUpperCase()}
                      </Text>
                      <View style={[S.row, { gap: 6, marginTop: 2 }]}>
                        <MaterialIcons name="near-me" size={20} color={C.accent} />
                        <Text style={{ color: C.text, fontSize: F.title, fontWeight: '800' }}>
                          {(o.distanceM / 1000).toFixed(1)} {t('km')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          color: urgent ? C.danger : C.muted,
                          fontSize: F.tiny,
                          letterSpacing: 0.6,
                        }}
                      >
                        {urgent ? t('hurry') : ''}
                      </Text>
                      <Text
                        style={{
                          color: urgent ? C.danger : C.warn,
                          fontSize: F.h2,
                          fontWeight: '800',
                          marginTop: 2,
                        }}
                      >
                        {remaining}s
                      </Text>
                    </View>
                  </View>

                  {/* Vaqt tugab borayotgani chiziq bilan ham ko'rinsin (raqamga qaramasdan). */}
                  <View
                    style={{
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: C.border,
                      marginTop: SP.md,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.min(100, (remaining / total) * 100)}%`,
                        height: '100%',
                        backgroundColor: urgent ? C.danger : C.warn,
                      }}
                    />
                  </View>

                  {o.pickupAddress ? (
                    <View style={[S.row, { gap: 6, marginTop: SP.md }]}>
                      <MaterialIcons name="location-on" size={18} color={C.accent} />
                      <Text style={{ color: C.text, fontSize: 15, flex: 1 }}>{o.pickupAddress}</Text>
                    </View>
                  ) : null}

                  {o.note ? (
                    <View
                      style={[
                        S.row,
                        {
                          gap: SP.sm,
                          marginTop: SP.md,
                          backgroundColor: C.panel2,
                          borderRadius: R.sm,
                          padding: SP.md,
                        },
                      ]}
                    >
                      <MaterialIcons name="chat-bubble-outline" size={16} color={C.warn} />
                      <Text style={{ color: C.text, fontSize: 14, flex: 1 }}>
                        {t('note')}: {o.note}
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[S.btnGhost, { marginTop: SP.md }]}
                    onPress={() => setExpandedId(expanded ? null : o.orderId)}
                  >
                    <View style={[S.row, { gap: 6 }]}>
                      <MaterialIcons
                        name={expanded ? 'expand-less' : 'map'}
                        size={18}
                        color={C.text}
                      />
                      <Text style={S.btnGhostText}>
                        {expanded ? t('hide_map') : t('show_map')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={{ marginTop: SP.md }}>
                      <MiniMap
                        height={180}
                        markers={
                          [
                            {
                              lat: o.pickup.lat,
                              lng: o.pickup.lng,
                              color: C.danger,
                              label: t('customer'),
                            },
                            ...(lastLoc.current
                              ? [
                                  {
                                    lat: lastLoc.current.lat,
                                    lng: lastLoc.current.lng,
                                    color: C.online,
                                    label: t('online'),
                                  },
                                ]
                              : []),
                          ] as MapMarker[]
                        }
                      />
                      <TouchableOpacity
                        style={[S.btnGhost, { marginTop: SP.sm }]}
                        onPress={() => navigate(o.pickup)}
                      >
                        <View style={[S.row, { gap: 6 }]}>
                          <MaterialIcons name="navigation" size={18} color={C.text} />
                          <Text style={S.btnGhostText}>{t('navigate')}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* "Rad etish" tor va rangsiz, "Qabul qilish" keng va yashil —
                      ular tasodifan almashtirilmasligi kerak. */}
                  <View style={[S.row, { marginTop: SP.lg, gap: SP.md }]}>
                    <TouchableOpacity
                      style={[
                        S.btnGhost,
                        { flex: 1, borderColor: C.danger, backgroundColor: 'transparent' },
                      ]}
                      onPress={() => respond(o.orderId, false)}
                    >
                      <Text style={[S.btnGhostText, { color: C.danger }]}>{t('decline')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[S.btn, S.btnOk, { flex: 2 }]}
                      onPress={() => respond(o.orderId, true)}
                    >
                      <Text style={S.btnOkText}>{t('accept')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
