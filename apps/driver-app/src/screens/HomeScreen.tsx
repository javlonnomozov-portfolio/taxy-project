import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Socket } from 'socket.io-client';
import { connectDriver, EV } from '../socket';
import { api } from '../api';
import { registerForPush, notifyOffer } from '../push';
import { startBackgroundLocation, stopBackgroundLocation } from '../location-task';
import { S, C } from '../theme';
import { Lang, makeT } from '../i18n';
import { MiniMap, MapMarker } from '../MapView';

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
  const [offer, setOffer] = useState<Offer | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [distanceM, setDistanceM] = useState(0);
  const [done, setDone] = useState<{ price: number } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastLoc = useRef<{ lat: number; lng: number } | null>(null);
  const tripRef = useRef<Trip | null>(null);
  tripRef.current = trip;
  const wantOnlineRef = useRef(false); // socket handlerlari uchun "onlayn bo'lishni xohlayapti"
  const registerOnlineRef = useRef<() => void>(() => {});

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
      if (!tripRef.current) {
        setOffer(o);
        setCountdown(o.timeoutSec ?? 120);
        // Fon rejimida ham diqqatni tortish uchun ovozli bildirishnoma.
        void notifyOffer((o.distanceM / 1000).toFixed(1));
      }
    });
    s.on(EV.orderOfferCancelled, (o: { orderId: string }) => {
      setOffer((cur) => (cur?.orderId === o.orderId ? null : cur));
    });
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
        setOffer((cur) => {
          const pickup = a.pickup ?? cur?.pickup ?? { lat: 0, lng: 0 };
          setTrip({
            orderId: a.orderId,
            pickup,
            pickupAddress: a.pickupAddress ?? cur?.pickupAddress,
            dest: a.dest ?? cur?.dest,
            destAddress: a.destAddress ?? cur?.destAddress,
            customer: a.customer,
            meter: a.meterConfig,
            stage: 'accepted',
          });
          return null;
        });
        setDistanceM(0);
      },
    );
    // Safar mijoz/operator tomonidan bekor qilindi — ekranni yopib, yana buyurtma qabul qilamiz.
    s.on(EV.tripEnded, (e: { orderId: string; reason?: string }) => {
      setOffer((cur) => (cur?.orderId === e.orderId ? null : cur));
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

  // Taklif taymeri
  useEffect(() => {
    if (!offer) return;
    if (countdown <= 0) {
      respond(false);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [offer, countdown]);

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

  function respond(accept: boolean) {
    if (!offer) return;
    socketRef.current?.emit(EV.offerResponse, { orderId: offer.orderId, accept });
    if (!accept) setOffer(null);
  }

  function tripAction(ev: string, nextStage?: Stage) {
    if (!trip) return;
    socketRef.current?.emit(ev, { orderId: trip.orderId });
    if (nextStage) setTrip({ ...trip, stage: nextStage });
  }

  function complete() {
    if (!trip) return;
    socketRef.current?.emit(
      EV.tripComplete,
      { orderId: trip.orderId, distanceM: Math.round(distanceM) },
      (resp: { finalPrice?: number }) => {
        setDone({ price: resp?.finalPrice ?? 0 });
        setTrip(null);
      },
    );
  }

  function cancelTrip() {
    if (!trip) return;
    socketRef.current?.emit(EV.tripCancel, { orderId: trip.orderId });
    setTrip(null);
  }

  const navigate = (p: { lat: number; lng: number }) =>
    Linking.openURL(`https://yandex.uz/maps/?rtext=~${p.lat},${p.lng}&rtt=auto`);
  const call = (phone: string) => Linking.openURL('tel:' + phone);

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
        </View>
      </ScrollView>
    );
  }

  // Asosiy: onlayn/oflayn + taklif
  return (
    <View style={S.screen}>
      <View style={[S.row, { justifyContent: 'space-between', marginBottom: 20 }]}>
        <Text style={S.title}>{t('app_name')}</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={{ color: C.muted }}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[S.card, { alignItems: 'center', paddingVertical: 30 }]}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: online ? C.ok : intent ? C.warn : C.muted,
            marginBottom: 10,
          }}
        />
        <Text
          style={{
            color: online ? C.ok : intent ? C.warn : C.muted,
            fontSize: 18,
            fontWeight: '700',
          }}
        >
          {online ? t('online') : intent ? t('connecting') : t('offline')}
        </Text>
        {online && <Text style={[S.label, { marginTop: 6 }]}>{t('waiting_orders')}</Text>}
      </View>

      <View style={{ marginTop: 20 }}>
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

      {/* Taklif modal (overlay) */}
      {offer && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
          }}
        >
          <View style={[S.card, { margin: 12, borderColor: C.accent, maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[S.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{t('new_order')}</Text>
              <Text style={{ color: C.warn, fontSize: 18, fontWeight: '800' }}>{countdown}s</Text>
            </View>
            <Text style={[S.label, { marginTop: 10 }]}>{t('distance_away')}</Text>
            <Text style={{ color: C.text, fontSize: 16 }}>
              {(offer.distanceM / 1000).toFixed(1)} {t('km')}
            </Text>
            {offer.pickupAddress ? (
              <>
                <Text style={[S.label, { marginTop: 8 }]}>📍 {t('customer_location')}</Text>
                <Text style={{ color: C.text }}>{offer.pickupAddress}</Text>
              </>
            ) : null}
            {offer.note ? (
              <>
                <Text style={[S.label, { marginTop: 8 }]}>{t('note')}</Text>
                <Text style={{ color: C.text }}>{offer.note}</Text>
              </>
            ) : null}
            {/* Mijoz qayerdaligini ko'rsatuvchi xarita */}
            <View style={{ marginTop: 12 }}>
              <MiniMap
                height={180}
                markers={
                  [
                    { lat: offer.pickup.lat, lng: offer.pickup.lng, color: '#ff4d4f', label: t('customer') },
                    ...(lastLoc.current
                      ? [{ lat: lastLoc.current.lat, lng: lastLoc.current.lng, color: '#3ddc84', label: t('online') }]
                      : []),
                  ] as MapMarker[]
                }
              />
            </View>
            <TouchableOpacity
              style={[S.btnGhost, { marginTop: 10 }]}
              onPress={() => navigate(offer.pickup)}
            >
              <Text style={S.btnGhostText}>🧭 {t('navigate')}</Text>
            </TouchableOpacity>
            <View style={[S.row, { marginTop: 12 }]}>
              <TouchableOpacity style={[S.btnGhost, { flex: 1, marginRight: 8 }]} onPress={() => respond(false)}>
                <Text style={[S.btnGhostText, { color: C.danger }]}>{t('decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.btn, S.btnOk, { flex: 2 }]} onPress={() => respond(true)}>
                <Text style={S.btnText}>{t('accept')}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
