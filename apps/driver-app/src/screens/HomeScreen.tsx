import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Socket } from 'socket.io-client';
import { connectDriver, EV, SocketAck } from '../socket';
import { api } from '../api';
import { registerForPush, notifyOffer } from '../push';
import { startBackgroundLocation, stopBackgroundLocation } from '../location-task';
import { S, C } from '../theme';
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
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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

  // Socket ulanish
  useEffect(() => {
    const s = connectDriver(token);
    socketRef.current = s;
    // Backend'ga "onlayn" yuborish — faqat ACK (ok) kelganda UI onlayn bo'ladi.
    const registerOnline = () =>
      s.emit(EV.online, {}, (ack?: { ok?: boolean }) => {
        if (ack?.ok) setOnline(true);
      });
    registerOnlineRef.current = registerOnline;
    // Ulanish/qayta ulanish: agar haydovchi ishlashni xohlasa — qayta ro'yxatdan o'tamiz.
    s.on('connect', () => {
      if (wantOnlineRef.current) registerOnline();
    });
    // Uzilish: backend grace'dan keyin oflayn qiladi — UI'da halol ko'rsatamiz ("Ulanmoqda…").
    s.on('disconnect', () => setOnline(false));
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
      if (st === 'active') void fetchPending();
    });
    const nsub = Notifications.addNotificationResponseReceivedListener(() => void fetchPending());
    void fetchPending();
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
    // Fon rejimida ham joylashuv (ilova yopiq bo'lsa HTTP orqali)
    void startBackgroundLocation();
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

  function cancelTrip() {
    if (!trip) return;
    socketRef.current?.emit(EV.tripCancel, { orderId: trip.orderId });
    setTrip(null);
  }

  const navigate = (p: { lat: number; lng: number }) =>
    Linking.openURL(`https://yandex.uz/maps/?rtext=~${p.lat},${p.lng}&rtt=auto`);
  const call = (phone: string) => Linking.openURL('tel:' + phone);

  if (showCabinet) {
    return <CabinetScreen lang={lang} token={token} onClose={() => setShowCabinet(false)} />;
  }

  // Yakuniy narx ekrani
  if (done) {
    return (
      <View style={[S.screen, S.center]}>
        <Text style={S.title}>✅ {t('trip_done')}</Text>
        <Text style={{ color: C.ok, fontSize: 40, fontWeight: '800', marginVertical: 16 }}>
          {done.price.toLocaleString('ru-RU')} {t('som')}
        </Text>
        <TouchableOpacity style={S.btn} onPress={() => setDone(null)}>
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
      <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={S.title}>{trip.stage === 'in_progress' ? t('on_trip') : t('to_customer')}</Text>
        <View style={[S.card, { marginVertical: 14 }]}>
          <Text style={S.label}>{t('customer')}</Text>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>
            {trip.customer.name || '—'}
          </Text>
          <Text style={{ color: C.accent, fontSize: 16, marginTop: 2 }}>{trip.customer.phone}</Text>
          {trip.stage === 'in_progress' && (
            <View style={{ marginTop: 14 }}>
              <Text style={S.label}>{t('meter')}</Text>
              <Text style={{ color: C.ok, fontSize: 30, fontWeight: '800' }}>
                {Math.round(liveMeter).toLocaleString('ru-RU')} {t('som')}
              </Text>
              <Text style={S.label}>
                {(distanceM / 1000).toFixed(1)} {t('km')}
              </Text>
            </View>
          )}
        </View>

        <MiniMap height={220} markers={tripMarkers} />

        <View style={{ gap: 10, marginTop: 14 }}>
          <View style={S.row}>
            <TouchableOpacity style={[S.btnGhost, { flex: 1, marginRight: 8 }]} onPress={() => navigate(navTarget)}>
              <Text style={S.btnGhostText}>🧭 {t('navigate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.btnGhost, { flex: 1 }]} onPress={() => call(trip.customer.phone)}>
              <Text style={S.btnGhostText}>📞 {t('call')}</Text>
            </TouchableOpacity>
          </View>

          {trip.stage === 'accepted' && (
            <TouchableOpacity style={S.btn} onPress={() => tripAction(EV.tripArrived, 'arrived')}>
              <Text style={S.btnText}>{t('arrived')}</Text>
            </TouchableOpacity>
          )}
          {trip.stage === 'arrived' && (
            <TouchableOpacity style={[S.btn, S.btnOk]} onPress={() => tripAction(EV.tripStart, 'in_progress')}>
              <Text style={S.btnText}>{t('start_trip')}</Text>
            </TouchableOpacity>
          )}
          {trip.stage === 'in_progress' && (
            <TouchableOpacity style={[S.btn, S.btnOk]} onPress={complete}>
              <Text style={S.btnText}>{t('finish_trip')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[S.btnGhost]} onPress={cancelTrip}>
            <Text style={[S.btnGhostText, { color: C.danger }]}>{t('cancel_trip')}</Text>
          </TouchableOpacity>

          {/* SOS — safar davomida doim qo'l ostida. Tasodifan bosilmasligi
              uchun tasdiq so'raladi (sendSos). */}
          <TouchableOpacity
            style={[S.btnGhost, { borderColor: C.danger }]}
            onPress={sendSos}
          >
            <Text style={[S.btnGhostText, { color: C.danger, fontWeight: '800' }]}>
              🆘 {t('sos')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Asosiy: onlayn/oflayn + takliflar ro'yxati
  return (
    <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={[S.row, { justifyContent: 'space-between', marginBottom: 20 }]}>
        <Text style={S.title}>{t('app_name')}</Text>
        <View style={[S.row, { gap: 16 }]}>
          <TouchableOpacity onPress={() => setShowCabinet(true)}>
            <Text style={{ color: C.accent, fontWeight: '700' }}>{t('cabinet')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout}>
            <Text style={{ color: C.muted }}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[S.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: online ? C.ok : intent ? C.warn : C.muted,
            marginBottom: 10,
          }}
        />
        <Text style={{ color: online ? C.ok : intent ? C.warn : C.muted, fontSize: 18, fontWeight: '700' }}>
          {online ? t('online') : intent ? t('connecting') : t('offline')}
        </Text>
        {online && offers.length === 0 && (
          <Text style={[S.label, { marginTop: 6 }]}>{t('waiting_orders')}</Text>
        )}
      </View>

      <View style={{ marginTop: 16 }}>
        {intent ? (
          <TouchableOpacity style={[S.btn, S.btnDanger]} onPress={goOffline}>
            <Text style={S.btnText}>{t('go_offline')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[S.btn, S.btnOk]} onPress={goOnline}>
            <Text style={S.btnText}>{t('go_online')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kutilayotgan takliflar RO'YXATI */}
      {offers.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={[S.title, { fontSize: 18, marginBottom: 10 }]}>
            {t('new_orders')} ({offers.length})
          </Text>
          {offers.map((o) => {
            const remaining = Math.max(0, Math.ceil((o.expiresAt - Date.now()) / 1000));
            const expanded = expandedId === o.orderId;
            return (
              <View key={o.orderId} style={[S.card, { marginBottom: 12, borderColor: C.accent }]}>
                <View style={[S.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
                    🚕 {(o.distanceM / 1000).toFixed(1)} {t('km')}
                  </Text>
                  <Text style={{ color: remaining <= 20 ? C.danger : C.warn, fontSize: 16, fontWeight: '800' }}>
                    {remaining}s
                  </Text>
                </View>
                {o.pickupAddress ? (
                  <Text style={{ color: C.text, marginTop: 6 }}>📍 {o.pickupAddress}</Text>
                ) : null}
                {o.note ? <Text style={[S.label, { marginTop: 4 }]}>{t('note')}: {o.note}</Text> : null}

                <TouchableOpacity
                  style={[S.btnGhost, { marginTop: 10 }]}
                  onPress={() => setExpandedId(expanded ? null : o.orderId)}
                >
                  <Text style={S.btnGhostText}>
                    {expanded ? '▲ ' + t('hide_map') : '📍 ' + t('show_map')}
                  </Text>
                </TouchableOpacity>
                {expanded && (
                  <View style={{ marginTop: 10 }}>
                    <MiniMap
                      height={180}
                      markers={
                        [
                          { lat: o.pickup.lat, lng: o.pickup.lng, color: '#ff4d4f', label: t('customer') },
                          ...(lastLoc.current
                            ? [{ lat: lastLoc.current.lat, lng: lastLoc.current.lng, color: '#3ddc84', label: t('online') }]
                            : []),
                        ] as MapMarker[]
                      }
                    />
                    <TouchableOpacity style={[S.btnGhost, { marginTop: 8 }]} onPress={() => navigate(o.pickup)}>
                      <Text style={S.btnGhostText}>🧭 {t('navigate')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[S.row, { marginTop: 12 }]}>
                  <TouchableOpacity style={[S.btnGhost, { flex: 1, marginRight: 8 }]} onPress={() => respond(o.orderId, false)}>
                    <Text style={[S.btnGhostText, { color: C.danger }]}>{t('decline')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.btn, S.btnOk, { flex: 2 }]} onPress={() => respond(o.orderId, true)}>
                    <Text style={S.btnText}>{t('accept')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
