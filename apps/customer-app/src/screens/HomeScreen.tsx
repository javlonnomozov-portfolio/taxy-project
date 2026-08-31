import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { LiveMap, MapMarker, PickupPicker } from '../MapView';
import { C, F, L, S, SP, shadow } from '../theme';
import { Lang, makeT } from '../i18n';

type Category = 'standard' | 'comfort' | 'cargo';

interface TariffRow {
  category: Category;
  baseFare: number;
  perKm: number;
}

type AddressLabel = 'home' | 'work';
type Point = { lat: number; lng: number };
interface SavedAddresses {
  home: Point | null;
  work: Point | null;
}
const EMPTY_ADDRESSES: SavedAddresses = { home: null, work: null };

interface TrackView {
  orderId: string;
  orderStatus: string;
  pickup: { lat: number; lng: number };
  driver: { lat: number; lng: number; at: string | null } | null;
  car: { name: string; plate: string; model: string; phone: string; rating: number } | null;
  finished: boolean;
  finalPrice: number | null;
  completed: boolean;
  rated: boolean;
  cancellable: boolean;
}

const FALLBACK = { lat: 39.7683, lng: 67.2792 }; // xizmat hududi markazi
/**
 * GPS'ni shuncha kutamiz, keyin tashlab ketamiz.
 *
 * `getCurrentPositionAsync` o'zida timeout yo'q va signal zaif joyda
 * cheksiz osilib qoladi — foydalanuvchi qurilmada aynan shuni ko'rdi
 * (tugma bosilgach spinner abadiy aylanardi).
 */
const GPS_TIMEOUT_MS = 8000;
const som = (v: number) => Math.round(v).toLocaleString('ru-RU');
const CATEGORIES: Category[] = ['standard', 'comfort', 'cargo'];
const CATEGORY_ICON: Record<Category, keyof typeof MaterialIcons.glyphMap> = {
  standard: 'directions-car',
  comfort: 'airline-seat-recline-extra',
  cargo: 'local-shipping',
};

/** Ikki nuqta orasidagi masofa (km) — haydovchi qancha uzoqligini ko'rsatish uchun. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R_KM = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// --- Maketdagi qayta ishlatiladigan bo'laklar ------------------------------

/**
 * Asosiy tugma yonidagi kvadrat tugma (maketda 65x60 dp).
 *
 * Maketda xarita ekranidan Buyurtmalar/Profil'ga o'tishning BOSHQA yo'li
 * yo'q edi — pastki tab paneli ham chizilmagan. Shu kvadrat tugma yagona
 * o'tish nuqtasi, shuning uchun u "kabinet" tugmasi.
 */
function SquareBtn({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: L.square,
        height: L.cta.height,
        borderRadius: L.cta.radius,
        backgroundColor: C.panel2,
        borderColor: C.border,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialIcons name={icon} size={26} color={C.text} />
    </TouchableOpacity>
  );
}

/** Panel pastidagi keng tugma: sarlavha + ixtiyoriy kichik izoh. */
function Cta({
  title,
  sub,
  onPress,
  busy,
  danger,
  disabled,
}: {
  title: string;
  sub?: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy || disabled}
      style={{
        flex: 1,
        height: L.cta.height,
        borderRadius: L.cta.radius,
        backgroundColor: danger ? C.dangerSolid : C.ok,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: busy || disabled ? 0.55 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Text style={{ color: '#FFFFFF', fontSize: F.h2, fontWeight: '800' }}>{title}</Text>
          {sub ? (
            <Text style={{ color: '#FFFFFF', fontSize: F.tiny, opacity: 0.9, marginTop: 2 }}>
              {sub}
            </Text>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

/** "1ta - 4ta / 5+" ajratkichi — maketdagi yumaloq ikki bo'lakli tugma. */
function Segment({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        height: L.segment.height,
        borderRadius: L.segment.radius,
        backgroundColor: C.panel2,
        padding: L.segment.pad,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingHorizontal: SP.lg,
              borderRadius: L.segment.radius,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? C.accent : 'transparent',
            }}
          >
            <Text
              style={{
                color: active ? '#FFFFFF' : C.muted,
                fontSize: F.body,
                fontWeight: '700',
              }}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Xarita ustidagi yumaloq tugma — GPS va saqlangan manzillar. */
function FloatBtn({
  children,
  onPress,
  onLongPress,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        shadow,
        {
          minWidth: 46,
          height: 46,
          paddingHorizontal: SP.md,
          borderRadius: 23,
          backgroundColor: C.panel,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          // Android'da WebView ustidagi element `elevation`siz bosilmay qolishi mumkin.
          elevation: 4,
        },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

/**
 * Xarita ustida suzuvchi pastki panel.
 *
 * MODUL DARAJASIDA e'lon qilingan (komponent ichida emas): ichkarida
 * e'lon qilinsa React uni har renderda YANGI komponent turi deb biladi va
 * butun ichki daraxtni yechib qayta o'rnatadi — baho izohi maydoni har
 * bosishda fokusni yo'qotardi.
 *
 * `onHeight` — o'lchangan balandlik. Xaritadagi pin aynan shu son bo'yicha
 * panel ustiga ko'chiriladi (`PickupPicker.bottomInset`).
 */
function Sheet({
  onHeight,
  children,
}: {
  onHeight: (h: number) => void;
  children: React.ReactNode;
}) {
  return (
    <View
      onLayout={(e) => onHeight(Math.round(e.nativeEvent.layout.height))}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.panel,
        borderTopLeftRadius: L.sheetRadius,
        borderTopRightRadius: L.sheetRadius,
        paddingHorizontal: L.sheetPad,
        paddingTop: SP.lg,
        paddingBottom: SP.xl,
        borderTopColor: C.border,
        borderTopWidth: 1,
        elevation: 16,
        shadowColor: '#101828',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      }}
    >
      {children}
    </View>
  );
}

// --- Ekran -----------------------------------------------------------------

export function HomeScreen({
  lang,
  token,
  onOpenAccount,
}: {
  lang: Lang;
  token: string;
  onOpenAccount: () => void;
}) {
  const t = makeT(lang);
  const fmt = (key: string, v: string) => t(key).replace('{v}', v);
  const [pickup, setPickup] = useState(FALLBACK);
  const [category, setCategory] = useState<Category>('standard');
  const [tariffs, setTariffs] = useState<TariffRow[]>([]);
  const [addresses, setAddresses] = useState<SavedAddresses>(EMPTY_ADDRESSES);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [view, setView] = useState<TrackView | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rateSent, setRateSent] = useState(false);
  const [comment, setComment] = useState('');
  const [locating, setLocating] = useState(false);
  /**
   * Maketdagi ajratkich: "1ta - 4ta" yoki "5+".
   *
   * "1ta - 4ta" da yo'lovchilar soni SERVERGA UMUMAN YUBORILMAYDI — xuddi
   * bot/Mini App oqimidagidek, ya'ni sig'im filtri o'chiq qoladi. Aks holda
   * "4 kishi" deb yuborilsa haydovchiga noto'g'ri son ko'rinardi.
   */
  const [paxBig, setPaxBig] = useState(false);
  /** "5+" tanlanganda ANIQ son — maketda yo'q, lekin usiz 7 kishilik guruhga
   *  5 o'rinli mashina yuborilishi mumkin edi (Damas 7, Cobalt 4). */
  const [paxCount, setPaxCount] = useState(5);
  /** Foydalanuvchining haqiqiy GPS nuqtasi — xaritadagi ko'k doira. */
  const [myLocation, setMyLocation] = useState<Point | null>(null);
  /** Oshirilsa xarita `pickup` ga majburan ko'chadi (`PickupPicker` izohiga qarang). */
  const [moveToken, setMoveToken] = useState(0);
  /** Panel o'lchangan balandligi — xaritadagi pin shuning ustida turadi. */
  const [sheetH, setSheetH] = useState(260);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Pinni belgilangan nuqtaga ko'chirish — xaritani ham surib qo'yadi. */
  const movePin = useCallback((p: Point) => {
    setPickup(p);
    setMoveToken((v) => v + 1);
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /**
   * Joriy joylashuvni olib pinni o'sha yerga ko'chiradi.
   *
   * `ask` — ruxsat oynasini ochish mumkinmi. Ilova ochilganda `true`
   * (foydalanuvchi ekranga qarab turibdi), lekin AVTOMATIK yo'llarda
   * ruxsat SO'RAMASLIK kerak: ilova fonda ishga tushirilgan bo'lsa Activity
   * bo'lmaydi va jarayon o'ladi (HANDOFF 5.1c).
   */
  const locate = useCallback(
    async (ask: boolean): Promise<boolean> => {
      try {
        const perm = ask
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return false;

        // 1) Oxirgi ma'lum nuqta — DARHOL qaytadi (kesh). Bino ichida yoki
        //    signal zaif joyda ham foydalanuvchi bo'sh ekranga qaramaydi.
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last) {
          const p = { lat: last.coords.latitude, lng: last.coords.longitude };
          setMyLocation(p);
          movePin(p);
        }

        // 2) Aniq nuqta — LEKIN TIMEOUT bilan.
        //
        //    `getCurrentPositionAsync` o'zida timeout YO'Q: sun'iy yo'ldosh
        //    ushlanmasa u CHEKSIZ kutadi va spinner abadiy aylanaveradi
        //    (foydalanuvchi qurilmada aynan shuni ko'rdi). Shuning uchun
        //    poyga: qaysi biri oldin tugasa.
        const fresh = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((r) => setTimeout(() => r(null), GPS_TIMEOUT_MS)),
        ]);
        if (fresh) {
          const p = { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
          setMyLocation(p);
          movePin(p);
          return true;
        }
        // Aniq nuqta kelmadi — lekin kesh bo'lsa, bu HALI HAM muvaffaqiyat:
        // pin foydalanuvchining joyida turibdi.
        return !!last;
      } catch {
        return false; // GPS yo'q — pin turgan joyida qoladi
      }
    },
    [movePin],
  );

  // Ilova ochilganda bir marta — bo'lmasa xizmat hududi markazidan boshlaymiz:
  // xarita baribir ishlaydi, foydalanuvchi pinni o'zi suradi.
  useEffect(() => {
    void locate(true);
  }, [locate]);

  async function onLocatePress() {
    setLocating(true);
    const ok = await locate(true);
    setLocating(false);
    // Jimgina hech narsa qilmaslik eng yomon variant — foydalanuvchi tugma
    // buzuq deb o'ylaydi.
    if (!ok) Alert.alert(t('my_loc'), t('loc_failed'));
  }

  // Toifalar bazaviy narxi — admin panelda sozlanadi, yakuniy narx EMAS
  // (borish joyi tanlanmagani uchun km oldindan noma'lum).
  useEffect(() => {
    api<TariffRow[]>('GET', '/customer/tariffs', undefined, token)
      .then(setTariffs)
      .catch(() => {
        /* narx ko'rsatilmaydi, toifa tanlash baribir ishlaydi */
      });
  }, [token]);

  // "Uy"/"Ish" tez tugmalari (CUSTOMER-APP-PLAN.md ochiq savol #1).
  const loadAddresses = useCallback(async () => {
    try {
      const a = await api<SavedAddresses>('GET', '/customer/addresses', undefined, token);
      setAddresses(a);
    } catch {
      /* chip'lar "hali saqlanmagan" holatida qoladi — funksiya baribir ishlaydi */
    }
  }, [token]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  /**
   * Bosilganda: agar shu nom ostida manzil saqlangan bo'lsa — pin o'sha yerga
   * ko'chadi. Saqlanmagan bo'lsa — HOZIRGI pin nuqtasi shu nom bilan
   * saqlanadi (foydalanuvchi allaqachon xaritada kerakli joyni belgilagan
   * bo'ladi, alohida "saqlash" oqimi shart emas).
   */
  async function onAddressPress(label: AddressLabel) {
    const saved = addresses[label];
    if (saved) {
      movePin(saved);
      return;
    }
    try {
      const a = await api<SavedAddresses>('PUT', `/customer/addresses/${label}`, pickup, token);
      setAddresses(a);
    } catch {
      Alert.alert(t('err'));
    }
  }

  /** Uzoq bosish — saqlangan manzilni o'chirish (qayta belgilash uchun). */
  function onAddressLongPress(label: AddressLabel) {
    if (!addresses[label]) return;
    Alert.alert(t(label === 'home' ? 'addr_home' : 'addr_work'), t('addr_clear_confirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            const a = await api<SavedAddresses>(
              'DELETE',
              `/customer/addresses/${label}`,
              undefined,
              token,
            );
            setAddresses(a);
          } catch {
            /* jim — foydalanuvchi qayta urinishi mumkin */
          }
        },
      },
    ]);
  }

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
        // "1ta - 4ta" da son YUBORILMAYDI — sig'im filtri o'chiq qolsin
        // (server faqat `> 4` da tekshiradi, yuqoridagi izohga qarang).
        { category, pickup, ...(paxBig ? { passengers: paxCount } : {}) },
        token,
      );
      setOrderId(r.orderId);
      setRateSent(false);
      setComment('');
    } catch (e) {
      setErr((e as Error).message || t('err'));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    // `view` hali 5s'lik poll bilan yangilanmagan bo'lsa (masalan allaqachon
    // bekor qilingan), tugma bir lahza ko'rinishda qolishi mumkin — ikkinchi
    // bosish serverdan "Bekor qilib bo'lmaydi" xatosini qaytarardi. So'rov
    // davomida tugmani o'chirib qo'yamiz.
    if (!orderId || !view || cancelling) return;
    const msg = view.car ? t('cancel_confirm_penalty') : t('cancel_confirm');
    Alert.alert(t('cancel_btn'), msg, [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const r = await api<{ penalized: boolean }>(
              'POST',
              `/customer/orders/${orderId}/cancel`,
              {},
              token,
            );
            Alert.alert(t('cancelled'), r.penalized ? t('cancelled_penalty') : t('cancelled_free'));
          } catch (e) {
            Alert.alert(t('err'), (e as Error).message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  async function rate(score: number) {
    if (!orderId) return;
    setRateSent(true);
    try {
      await api(
        'POST',
        `/customer/orders/${orderId}/rate`,
        { score, comment: comment.trim() || undefined },
        token,
      );
    } catch {
      setRateSent(false);
    }
  }

  function reset() {
    stop();
    setOrderId(null);
    setView(null);
    setRateSent(false);
    setErr(null);
  }

  const statusText = (st: string) =>
    st === 'ARRIVED'
      ? t('arrived')
      : st === 'IN_PROGRESS'
        ? t('in_progress')
        : st === 'ACCEPTED' || st === 'CONFIRMED' || st === 'ARRIVING'
          ? t('on_the_way')
          : // `NO_DRIVER` alohida: aks holda "Taksi qidirilmoqda…" ABADIY
            // ko'rinardi, mijoz haydovchi haqiqatan topilmaganini bilmasdi
            // (bot esa aynan shu holatda xabar yuboradi — matn muvofiqlashtirilgan).
            st === 'NO_DRIVER'
            ? t('no_driver_short')
            : t('searching');

  const markers: MapMarker[] = view
    ? ([
        { lat: view.pickup.lat, lng: view.pickup.lng, color: C.danger, label: t('you') },
        ...(view.driver
          ? [{ lat: view.driver.lat, lng: view.driver.lng, color: C.online, label: t('taxi') }]
          : []),
      ] as MapMarker[])
    : [];

  /** Tanlangan toifa tarifi — tugma ostidagi "...dan boshlab" uchun. */
  const activeTariff = tariffs.find((x) => x.category === category);
  const distanceKm = view?.driver && !view.finished ? haversineKm(view.driver, view.pickup) : null;

  // Xarita panel ostiga kirib ketmasin: pastki chekka + panel balandligi.
  const floatBottom = sheetH + SP.md;

  const accountBtn = <SquareBtn icon="person" onPress={onOpenAccount} label={t('account')} />;

  // ---------- BUYURTMA REJIMI ----------
  if (!orderId) {
    return (
      <View style={{ flex: 1, backgroundColor: C.mapBg }}>
        <PickupPicker
          center={pickup}
          moveToken={moveToken}
          myLocation={myLocation}
          bottomInset={sheetH}
          onChange={setPickup}
        />

        {/* Saqlangan manzillar — maketda yo'q, lekin ishlab turgan funksiya.
            Panelga emas, xarita ustiga qo'yildi: panel maketdagidek qoladi. */}
        <View
          style={{
            position: 'absolute',
            left: SP.md,
            bottom: floatBottom,
            gap: SP.sm,
            alignItems: 'flex-start',
          }}
        >
          {(['home', 'work'] as AddressLabel[]).map((label) => {
            const saved = !!addresses[label];
            return (
              <FloatBtn
                key={label}
                onPress={() => onAddressPress(label)}
                onLongPress={() => onAddressLongPress(label)}
                label={t(label === 'home' ? 'addr_home' : 'addr_work')}
              >
                <MaterialIcons
                  name={label === 'home' ? 'home' : 'work'}
                  size={20}
                  color={saved ? C.accent : C.muted}
                />
                <Text
                  style={{
                    color: saved ? C.accent : C.muted,
                    fontWeight: '700',
                    fontSize: F.label,
                  }}
                >
                  {t(label === 'home' ? 'addr_home' : 'addr_work')}
                </Text>
              </FloatBtn>
            );
          })}
        </View>

        <View style={{ position: 'absolute', right: SP.md, bottom: floatBottom }}>
          <FloatBtn onPress={onLocatePress} label={t('my_loc')}>
            {locating ? (
              <ActivityIndicator color={C.accent} size="small" />
            ) : (
              <MaterialIcons name="my-location" size={24} color={C.accent} />
            )}
          </FloatBtn>
        </View>

        <Sheet onHeight={setSheetH}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SP.sm,
            }}
          >
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
              {t('pax_label')}
            </Text>
            <Segment
              options={[
                { key: 'small', label: t('pax_small') },
                { key: 'big', label: t('pax_big') },
              ]}
              value={paxBig ? 'big' : 'small'}
              onChange={(k) => setPaxBig(k === 'big')}
            />
          </View>

          {/* Aniq son — maketdagi "5+" ni ochib beradi. Usiz 7 kishilik guruh
              5 o'rinli mashinaga tushib qolishi mumkin edi. */}
          {paxBig ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SP.sm,
                marginTop: SP.md,
              }}
            >
              <Text style={{ color: C.muted, fontSize: F.label }}>{t('pax_exact')}</Text>
              {[5, 6, 7, 8].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setPaxCount(n)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: paxCount === n ? C.accentSoft : C.panel2,
                    borderWidth: 1,
                    borderColor: paxCount === n ? C.accent : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: paxCount === n ? C.accent : C.muted,
                      fontWeight: '700',
                    }}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.lg }}>
            {CATEGORIES.map((c) => {
              const tariff = tariffs.find((x) => x.category === c);
              const active = category === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={{
                    flex: 1,
                    height: L.card.height,
                    borderRadius: L.card.radius,
                    borderWidth: 1,
                    borderColor: active ? C.accent : C.border,
                    backgroundColor: active ? C.accentSoft : C.panel,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <MaterialIcons
                    name={CATEGORY_ICON[c]}
                    size={26}
                    color={active ? C.accent : C.muted}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: C.text,
                      fontSize: F.label,
                      fontWeight: '700',
                      marginTop: 4,
                    }}
                  >
                    {t('cat_' + c)}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: F.tiny, marginTop: 1 }}>
                    {tariff ? fmt('price_from', som(tariff.baseFare)) : ' '}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {err ? <Text style={[S.err, { marginTop: SP.md }]}>{err}</Text> : null}

          <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.lg }}>
            {accountBtn}
            <Cta
              title={t('order_btn')}
              sub={
                activeTariff
                  ? `${t('cat_' + category)} · ${fmt('price_from', som(activeTariff.baseFare))}`
                  : undefined
              }
              onPress={order}
              busy={busy}
            />
          </View>
        </Sheet>
      </View>
    );
  }

  // ---------- KUZATUV REJIMI ----------
  // Xarita SHU YERDA ham to'liq ekran bo'ylab qoladi (maketdagidek) — avval
  // alohida scroll sahifaga o'tilardi va safar davomida xarita kichkina
  // oynachaga siqilardi.
  return (
    <View style={{ flex: 1, backgroundColor: C.mapBg }}>
      <LiveMap markers={markers} bottomInset={sheetH} />

      <Sheet onHeight={setSheetH}>
        <Text style={{ color: C.text, fontSize: F.title, fontWeight: '800' }}>
          {view
            ? view.finished
              ? t(view.completed ? 'finished' : 'cancelled')
              : statusText(view.orderStatus)
            : t('searching')}
        </Text>

        {view && !view.finished && view.orderStatus === 'NO_DRIVER' ? (
          <Text style={{ color: C.muted, fontSize: F.label, marginTop: SP.sm, lineHeight: 19 }}>
            {t('no_driver_info')}
          </Text>
        ) : null}

        {err ? <Text style={[S.err, { marginTop: SP.sm }]}>{err}</Text> : null}

        {view?.car ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SP.md,
              marginTop: SP.lg,
              backgroundColor: C.panel2,
              borderRadius: L.card.radius,
              padding: SP.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: C.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="local-taxi" size={24} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>
                {view.car.name}
                {view.car.model ? ` · ${view.car.model}` : ''}
              </Text>
              <Text style={{ color: C.muted, fontSize: F.label, marginTop: 2 }}>
                {view.car.plate}
                {distanceKm != null ? ` · ${fmt('distance_away', distanceKm.toFixed(1))}` : ''}
              </Text>
            </View>
            {view.car.rating > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialIcons name="star" size={16} color={C.gold} />
                <Text style={{ color: C.text, fontWeight: '700' }}>
                  {view.car.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {view?.finished && view.completed ? (
          <View style={{ alignItems: 'center', marginTop: SP.md }}>
            <Text style={{ color: C.muted, fontSize: F.label }}>{t('price')}</Text>
            <Text style={{ color: C.ok, fontSize: F.hero, fontWeight: '800' }}>
              {som(view.finalPrice ?? 0)} <Text style={{ fontSize: F.h2 }}>{t('som')}</Text>
            </Text>

            {view.rated || rateSent ? (
              <Text style={{ color: C.ok, fontWeight: '700', marginTop: SP.md }}>
                {t('thanks_rating')}
              </Text>
            ) : (
              <View style={{ width: '100%' }}>
                <Text style={[S.label, { marginTop: SP.md, textAlign: 'center' }]}>
                  {t('rate_prompt')}
                </Text>
                <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.sm }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[S.btnGhost, { flex: 1 }]}
                      onPress={() => rate(n)}
                    >
                      <Text style={S.btnGhostText}>{n}⭐</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[S.input, { marginTop: SP.md, minHeight: 60, textAlignVertical: 'top' }]}
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t('rate_comment_ph')}
                  placeholderTextColor={C.muted}
                  multiline
                />
              </View>
            )}
          </View>
        ) : null}

        {/* Qo'ng'iroq — haydovchi topilganda asosiy amal shu bo'ladi,
            bekor qilish esa pastdagi kichik havolaga tushadi. */}
        <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.lg }}>
          {accountBtn}
          {view?.finished ? (
            <Cta title={t('new_order')} onPress={reset} />
          ) : view?.car?.phone ? (
            <Cta
              title={`📞 ${view.car.phone}`}
              onPress={() => Linking.openURL('tel:' + view.car!.phone)}
            />
          ) : (
            <Cta
              title={t('cancel_short')}
              onPress={cancel}
              busy={cancelling}
              danger
              disabled={!view?.cancellable}
            />
          )}
        </View>

        {/* Haydovchi topilgan holatda bekor qilish — ikkinchi darajali amal. */}
        {view && !view.finished && view.car && view.cancellable ? (
          <TouchableOpacity
            onPress={cancel}
            disabled={cancelling}
            style={{ alignItems: 'center', paddingTop: SP.md }}
          >
            <Text style={{ color: C.danger, fontWeight: '600', fontSize: F.label }}>
              {cancelling ? '…' : t('cancel_btn')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </Sheet>
    </View>
  );
}
