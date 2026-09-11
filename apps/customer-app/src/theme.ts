import { Platform, StyleSheet } from 'react-native';

// Dizayn tokenlari — Figma "Toy taxi" maketidan, "rider app" bo'limi
// (fayl 8RflGALB1D3QfFWy9id1XG, node 111:378). Rang/o'lcham o'zgarsa FAQAT
// shu fayl tahrirlanadi — ekranlarga tegilmaydi.
//
// Sonlar maketdan UCHGA BO'LINIB olingan: maket 1080 px kenglikda chizilgan,
// telefon esa 360 dp. Izohlardagi qavs ichidagi son — maketdagi asl qiymat.
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
  muted: 'rgba(23, 30, 42, 0.5)',
  /** Maketdagi ikki xil chegara: kuchli (toifa kartasi) va yumshoq (tarix). */
  border: '#999999',
  hairline: 'rgba(0, 0, 0, 0.25)',

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

/** Burchak radiuslari. */
export const R = { sm: 12, md: 14, lg: 20, xl: 23, card: 14, field: 6, pill: 999 };

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
  tiny: 10,
};

/** Bo'shliq shkalasi. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

/** Maketdan olingan o'lchamlar (px / 3). */
export const L = {
  /** Pastki panel (maketda radius 70/87 — assimetriya, o'rtachasi olindi). */
  sheetRadius: 26,
  sheetPad: 12,
  /** Toifa kartasi — 109x77 dp (327x231). */
  card: { height: 77, radius: R.card, image: { w: 73, h: 42 } },
  /** Yo'lovchilar tanlagichi — 208x42 dp (625x126). */
  segment: { height: 42, pad: 4, radius: R.pill },
  /** Asosiy tugma — 268x60 dp (805x181), radius 14 dp (42). */
  cta: { height: 60, radius: R.card },
  /** "Bekor qilish!" maketda ANCHA yumaloq (77) — asosiy tugmadan farq qilsin. */
  cancelRadius: 26,
  /** Asosiy tugma yonidagi kvadrat tugma — 65x60 dp (195x181). */
  square: { w: 65, radius: R.card },
  /** Kabinet sarlavhasidagi yumaloq tugma va tab konteyneri (180 / 775x180). */
  navBtn: { size: 60, radius: 16 },
  headerPill: { height: 60, radius: 30 },
  /** Kabinet: avatar 103 dp (309), maydon qutisi 328x45 dp (983x134). */
  avatar: 103,
  field: { height: 45, radius: R.field },
  /** Tarix kartasi — 328x73 dp (983x218), radius 10 dp (30). */
  histCard: { height: 73, radius: 10 },
};

/** Birlamchi tugma balandligi — bir qo'l bilan bosiladi. */
const TAP = 56;

/**
 * Ko'tarilgan yuza soyasi. Oq dizaynda kartalar FAQAT soya bilan ajraladi
 * (qorong'ida fon farqi yetardi), shuning uchun bu bezak emas.
 */
export const shadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: INK,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
}) as object;

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
    borderColor: C.border,
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
    borderBottomColor: '#EEEEEE',
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
