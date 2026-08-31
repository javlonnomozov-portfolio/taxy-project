import { Platform, StyleSheet } from 'react-native';

// Dizayn tokenlari — Figma "Toy taxi" maketidan (fayl 8RflGALB1D3QfFWy9id1XG,
// "rider app" bo'limi, node 111:378). Rang/o'lcham o'zgarsa FAQAT shu fayl
// tahrirlanadi — ekranlarga tegilmaydi.
//
// DIQQAT: mijoz ilovasi OCH temada, haydovchi ilovasi esa TO'Q temada.
// Ular ataylab boshqacha — `driver-app/src/theme.ts` bilan aralashtirmang.
//
// Nomlar IKKI xil: `primary/onPrimary/sheet/cardBg` (maketdan kelgan
// komponentlar shularni ishlatadi) va `ok/onOk/panel/panel2` (avvalgi
// ekranlar). Ikkalasi ham SHU YERDA bir xil qiymatga bog'langan — nom
// almashtirish uchun ekranlarni qayta yozish shart emas.

const GREEN = '#0CAF50'; // asosiy amal — "Taksi chaqirish"
const ORANGE = '#F68F0A'; // yo'lovchilar soni tanlagichi
const RED = '#E5484D';

export const C = {
  bg: '#FFFFFF',
  sheet: '#FFFFFF', // xarita ustidagi pastki karta
  panel: '#FFFFFF', // = sheet (eski nom)
  cardBg: '#FBFBFB',
  panel2: '#FBFBFB', // = cardBg (eski nom)
  /** Ajratkich/tanlagich yo'lagi — oq yuzada ko'rinishi uchun kuchliroq. */
  track: '#F0F1F3',

  text: '#171E2A',
  muted: 'rgba(23, 30, 42, 0.5)',
  border: '#999999',

  primary: GREEN,
  onPrimary: '#FFFFFF',
  primarySoft: '#E4F6EB', // tanlangan toifa kartasi foni
  accent: GREEN, // eski nom — havolalar, tanlangan holat
  accentSoft: '#E4F6EB',
  ok: GREEN,
  onOk: '#FFFFFF',
  online: GREEN,

  /** Yo'lovchilar soni tanlagichi — maketda ATAYLAB to'q sariq, yashil emas:
   *  u asosiy amal EMAS, shuning uchun "Taksi chaqirish" bilan raqobatlashmasin. */
  pax: ORANGE,
  onPax: '#FFFFFF',
  warn: ORANGE,
  warnSoft: 'rgba(246, 143, 10, 0.12)',
  gold: '#F5A623', // reyting yulduzi

  danger: RED,
  dangerSolid: RED,
  dangerSoft: 'rgba(229, 72, 77, 0.10)',

  /** Xarita (WebView) foni — plitalar yuklanguncha ko'rinadi. */
  mapBg: '#EDEDED',
  /** Xarita ustidagi tugma/panel foni. */
  chrome: 'rgba(255, 255, 255, 0.94)',
};

/** Burchak radiuslari. */
export const R = { sm: 12, md: 14, lg: 20, xl: 23, card: 14, pill: 999 };

/** Shrift o'lchamlari — maketdagi 1080 px kenglikdan 3x ga bo'lingan. */
export const F = {
  hero: 40, // yakuniy narx — ekrandagi eng katta son
  cta: 25, // "Taksi chaqirish"
  title: 20, // panel sarlavhasi ("Taksi qidirilmoqda…")
  h2: 20,
  h3: 17, // toifa nomi, maydon qiymati
  body: 16, // "Yo'lovchilar soni:", maydon yorlig'i
  label: 15,
  small: 13,
  tiny: 11, // toifa narxi, tugma ostidagi izoh
};

/** Bo'shliq shkalasi. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

/**
 * Maketdan olingan o'lchamlar (1080 px kenglik → 360 dp, ya'ni har son 3 ga
 * bo'lingan). Sonlar shu yerda turadi, ekranlarda emas.
 */
export const L = {
  /** Pastki panel: burchak radiusi va ichki chekka (maketda 26 / 8.7 dp). */
  sheetRadius: 26,
  sheetPad: 12,
  /** Toifa kartasi — maketda 109x77 dp. */
  card: { height: 84, radius: R.card, image: { w: 78, h: 46 } },
  /** "1ta-4ta / 5+" ajratkichi — maketda 208x42 dp. */
  segment: { height: 42, pad: 4, radius: R.pill },
  /** Asosiy tugma va uning yonidagi kvadrat tugma — 268x60 va 65x60 dp. */
  cta: { height: 60, radius: 18 },
  square: 60,
  /** Kabinet: yumaloq avatar 103 dp, maydon qutisi 328x45 dp. */
  avatar: 100,
  field: { height: 48, radius: R.card },
  /** Tarix kartasi — 328x73 dp. */
  histCard: { height: 76, radius: R.card },
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
    shadowColor: '#171E2A',
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
    borderColor: 'rgba(229, 72, 77, 0.35)',
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
