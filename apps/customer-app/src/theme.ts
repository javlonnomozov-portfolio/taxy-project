import { Platform, StyleSheet } from 'react-native';

// Dizayn tokenlari — Figma "Toy taxi" maketidan, "rider app" bo'limi
// (fayl 8RflGALB1D3QfFWy9id1XG, node 111:378). Rang/o'lcham o'zgarsa FAQAT
// shu fayl tahrirlanadi — ekranlarga tegilmaydi.
//
// Sonlar maketdan UCHGA BO'LINIB olingan: maket 1080 px kenglikda chizilgan,
// telefon esa 360 dp. Izohlardagi qavs ichidagi son — maketdagi asl qiymat.
//
// SILLIQLASH (2026-09-12, prototipdan): RANGLAR O'ZGARMADI — maketdagi
// yashil/to'q sariq/qizil aynan o'sha. O'zgargani:
//   - chegara: qattiq #999 o'rniga siyoh rangining shaffofi (soyalar bilan
//     birga kartalar baribir ajralib turadi, lekin panel "qafas" bo'lib
//     ko'rinmaydi);
//   - radiuslar bitta shkalada (avval 14/26/30/6 — to'rt xil qiymat edi);
//   - toifa narxi 10 -> 11 dp;
//   - ko'tarilgan yuzalar uchun `elev` — avval hamma narsa tekis edi.
//
// DIQQAT: mijoz ilovasi OCH temada, haydovchi ilovasi esa TO'Q temada.
// Ular ataylab boshqacha — `driver-app/src/theme.ts` bilan aralashtirmang.
//
// Nomlar IKKI xil: `primary/onPrimary/sheet/cardBg` va `ok/onOk/panel/panel2`
// (avvalgi ekranlar). Ikkalasi ham SHU YERDA bir xil qiymatga bog'langan.

const GREEN = '#0CAF50'; // asosiy amal — "Taksi chaqirish", tanlangan tab
const ORANGE = '#F68F0A'; // yo'lovchilar tanlagichi, joylashuv nuqtasi
const RED = '#BC0000'; // xarita pini va "Bekor qilish!" — maketdagi aniq qiymat
const INK = '#171E2A';

export const C = {
  bg: '#FFFFFF',
  /** Kabinet ekranlari foni va profil maydonlari — maketda oq EMAS. */
  screen: '#F4F7FB',
  sheet: '#FFFFFF', // xarita ustidagi pastki karta
  panel: '#FFFFFF', // = sheet (eski nom)
  cardBg: '#FBFBFB',
  panel2: '#FBFBFB', // = cardBg (eski nom)

  text: INK,
  muted: 'rgba(23, 30, 42, 0.52)',
  /**
   * Chegaralar. Maketda ikkalasi ham `#999` edi — oq yuzada bu juda qattiq
   * chiqib, har bir element qutiga solingandek ko'rinardi. Endi ular
   * SIYOH rangining shaffofi: fon bilan bir oilada turadi.
   */
  border: 'rgba(23, 30, 42, 0.16)', // toifa kartasi, kvadrat tugma, maydonlar
  hairline: 'rgba(23, 30, 42, 0.10)', // tarix kartasi, panel cheti

  primary: GREEN,
  onPrimary: '#FFFFFF',
  primarySoft: '#E4F6EB', // tanlangan toifa kartasi foni
  accent: GREEN, // eski nom
  accentSoft: '#E4F6EB',
  ok: GREEN,
  onOk: '#FFFFFF',
  online: GREEN,

  /**
   * Yo'lovchilar tanlagichi maketda ATAYLAB to'q sariq, yashil emas: u asosiy
   * amal EMAS va "Taksi chaqirish" bilan raqobatlashmasligi kerak.
   */
  pax: ORANGE,
  onPax: '#FFFFFF',
  warn: ORANGE,
  warnSoft: 'rgba(246, 143, 10, 0.12)',
  gold: '#F5A623', // reyting yulduzi

  danger: RED,
  dangerSolid: RED,
  dangerSoft: 'rgba(188, 0, 0, 0.08)',
  /** Xaritadagi pin — maketda aynan shu qizil. */
  pin: RED,

  /** Tarix kartasidagi ikkilamchi matnlar — maketda alohida qiymatlar. */
  dateMuted: '#8A8A8A',
  statusMuted: '#51565F',
  /** Kabinet avatari: och yashil doira + to'q sariq halqa. */
  avatarFill: '#91F8B9',
  avatarRing: ORANGE,

  /** Xarita (WebView) foni — plitalar yuklanguncha ko'rinadi. */
  mapBg: '#EDEDED',
  /** Xarita ustidagi tugma/panel foni. */
  chrome: 'rgba(255, 255, 255, 0.94)',
};

/**
 * Burchak radiuslari — BITTA shkala.
 *
 * Maketda 14 / 26 / 30 / 6 aralash edi; takrorlanuvchi elementlar bir-biriga
 * o'xshamay qolardi. Endi 12 / 16 / 28 uchligi hamma joyda ishlaydi.
 */
export const R = { sm: 12, md: 16, lg: 20, xl: 28, card: 16, field: 12, pill: 999 };

/** Shrift o'lchamlari (maketdagi px / 3). */
export const F = {
  hero: 40, // yakuniy narx — ekrandagi eng katta son
  cta: 25, // "Taksi chaqirish" (75)
  tab: 23, // "Buyurtmalar / Profil" (70)
  title: 21, // "Taksi qidirilmoqda ..." (64)
  h2: 20, // ErrorBoundary
  field: 18, // kabinet yorlig'i va qiymati (55)
  h3: 17, // segment matni, tarix toifasi (50)
  body: 16, // toifa nomi (48)
  label: 15,
  small: 13, // tarix meta, tugma ostidagi izoh (40)
  /**
   * Toifa narxi. Maketda 24 px = 8 dp — telefonda o'qib bo'lmaydi
   * (~6 pt), shuning uchun ATAYLAB kattalashtirildi.
   */
  tiny: 11,
};

/** Bo'shliq shkalasi. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

/** Maketdan olingan o'lchamlar (px / 3). */
export const L = {
  /** Pastki panel. Maketda radius chapda 70, o'ngda 87 edi — qiyshiq; tenglandi. */
  sheetRadius: R.xl,
  sheetPad: 12,
  /** Toifa kartasi — 109x77 dp (327x231). */
  card: { height: 77, radius: R.card, image: { w: 73, h: 42 } },
  /** Yo'lovchilar tanlagichi — 208x42 dp (625x126). */
  segment: { height: 42, pad: 4, radius: R.pill },
  /** Asosiy tugma — 268x60 dp (805x181). */
  cta: { height: 60, radius: R.card },
  /** "Bekor qilish!" maketda ANCHA yumaloq — asosiy tugmadan farq qilsin. */
  cancelRadius: 26,
  /** Asosiy tugma yonidagi kvadrat tugma — 65x60 dp (195x181). */
  square: { w: 65, radius: R.card },
  /** Kabinet sarlavhasidagi tugma va tab konteyneri (180 / 775x180). */
  navBtn: { size: 60, radius: R.card },
  headerPill: { height: 60, radius: 30 },
  /** Kabinet: avatar 103 dp (309), maydon qutisi 328x45 dp (983x134). */
  avatar: 103,
  field: { height: 45, radius: R.field },
  /** Tarix kartasi — 328x73 dp (983x218). */
  histCard: { height: 73, radius: R.card },
};

/** Birlamchi tugma balandligi — bir qo'l bilan bosiladi. */
const TAP = 56;

/**
 * Ko'tarilgan yuzalar.
 *
 * Oq dizaynda karta faqat soya bilan ajraladi (qorong'ida fon farqi yetardi),
 * shuning uchun bu bezak emas — chegara yumshatilgani uchun ayni vaqtda
 * ZARURAT ham. Android'da faqat `elevation` ishlaydi, iOS'da soya xossalari.
 */
function lift(elevation: number, opacity: number, radius: number, dy: number) {
  return Platform.select({
    android: { elevation },
    default: {
      shadowColor: INK,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: dy },
    },
  }) as object;
}

export const elev = {
  /** Karta, chip, xarita ustidagi tugma. */
  card: lift(1, 0.06, 6, 2),
  /** Tanlangan toifa, asosiy tugma, tanlangan tab. */
  raised: lift(4, 0.12, 12, 4),
  /** Pastki panel — soya YUQORIGA tushadi (iOS). */
  sheet: lift(16, 0.14, 18, -6),
};

/** Eski nom — hali ishlatilayotgan joylar uchun. */
export const shadow = elev.card;

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, padding: SP.xl },
  center: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },

  title: { color: C.text, fontSize: F.title, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: C.muted, fontSize: F.label, marginBottom: SP.xl, lineHeight: 21 },
  label: { color: C.muted, fontSize: F.small, marginBottom: 6 },

  input: {
    backgroundColor: C.cardBg,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.md,
    color: C.text,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.lg,
    fontSize: F.body,
    marginBottom: SP.lg,
  },

  /** Asosiy tugma — yashil, maketdagi "Taksi chaqirish". */
  btn: {
    backgroundColor: C.primary,
    borderRadius: R.card,
    minHeight: TAP,
    flexDirection: 'row', // ikonka + matn yonma-yon
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
  },
  btnText: { color: C.onPrimary, fontSize: F.body, fontWeight: '800' },
  btnOk: { backgroundColor: C.primary },
  btnOkText: { color: C.onPrimary, fontSize: F.h3, fontWeight: '800' },
  btnDanger: { backgroundColor: C.danger },

  btnGhost: {
    backgroundColor: C.cardBg,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.card,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.md,
  },
  btnGhostText: { color: C.text, fontSize: F.label, fontWeight: '700' },

  card: {
    backgroundColor: C.bg,
    borderColor: C.hairline,
    borderWidth: 1,
    borderRadius: R.card,
    padding: SP.lg,
  },

  err: { color: C.danger, fontSize: F.small, marginBottom: SP.md },
  /** Xato bloki — popup emas, ekranda turadi (diagnostika uchun muhim). */
  errBox: {
    backgroundColor: C.dangerSoft,
    borderColor: 'rgba(188, 0, 0, 0.35)',
    borderWidth: 1,
    borderRadius: R.sm,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.xl,
    paddingVertical: SP.md,
    borderBottomColor: C.hairline,
    borderBottomWidth: 1,
    backgroundColor: C.bg,
  },
  brand: { color: C.text, fontSize: F.title, fontWeight: '800' },

  /** Holat yorlig'i, yumaloq. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderWidth: 1,
  },
});
