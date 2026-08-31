import { Platform, StyleSheet } from 'react-native';

// Dizayn tokenlari — 2026-08-22 maketidan (oq fon + yashil aksent).
// Aniq eksport (HEX/Figma) kelganda FAQAT shu fayl yangilanadi, ekranlarga tegilmaydi.
//
// NEGA OQ: kunduzi quyoshda mijoz telefonini bir qo'lda ushlab turadi —
// oq fon yorug'da ancha o'qiladi. Ilgari qorong'i edi (haydovchi ilovasi
// bilan bir xil bo'lsin deb), lekin mijoz va haydovchi turli sharoitda
// ishlaydi va maket oq variantni belgiladi.

export const C = {
  bg: '#F7F8FA', // eng orqa fon — deyarli oq, kartalar ajralib tursin
  panel: '#FFFFFF', // karta
  panel2: '#F1F3F6', // ko'tarilgan yuza: input, chip, tab
  border: '#E4E7EC',
  text: '#101828',
  muted: '#667085',

  accent: '#00B14F', // brend yashili — havolalar, tanlangan holat
  accentSoft: 'rgba(0, 177, 79, 0.10)', // yashil fon (tanlangan toifa, ikonka doirasi)

  ok: '#00B14F', // birlamchi amal ("Taksi chaqirish")
  onOk: '#FFFFFF', // to'q yashil ustida OQ matn
  okSoft: 'rgba(0, 177, 79, 0.10)',
  online: '#00B14F',

  danger: '#D92D20',
  dangerSolid: '#D92D20',
  dangerSoft: 'rgba(217, 45, 32, 0.08)',

  warn: '#DC6803',
  warnSoft: 'rgba(220, 104, 3, 0.10)',
  gold: '#F79009', // reyting yulduzi

  /** Xarita (WebView) foni — plitalar yuklanguncha ko'rinadi. */
  mapBg: '#EAEEF3',
};

/** Burchak radiuslari. */
export const R = { sm: 10, md: 14, lg: 16, xl: 24, pill: 999 };

/**
 * Figma maketidan olingan o'lchamlar (2026-08-31, "rider app" bo'limi).
 *
 * Maket 1080 px kenglikda chizilgan, telefon esa 360 dp — shuning uchun
 * har bir son UCHGA BO'LINGAN. Sonlar shu yerda turadi, ekranlarda emas:
 * maket yangilansa faqat shu blok tuziladi.
 */
export const L = {
  /** Pastki panel: burchak radiusi va ichki chekka (maketda 26/8.7 dp). */
  sheetRadius: 26,
  sheetPad: 12,
  /** Toifa kartasi — 109x77 dp maketda. */
  card: { height: 80, radius: 16, iconBox: 42 },
  /** "1ta-4ta / 5+" ajratkichi — 208x42 dp. */
  segment: { height: 42, pad: 4, radius: 999 },
  /** Asosiy tugma va uning yonidagi kvadrat tugma — 268x60 va 65x60 dp. */
  cta: { height: 60, radius: 18 },
  square: 60,
  /** Kabinet: yumaloq avatar 103 dp, maydon qutisi 328x45 dp. */
  avatar: 100,
  field: { height: 48, radius: 14 },
  /** Tarix kartasi — 328x73 dp. */
  histCard: { height: 76, radius: 16 },
};

/** Shrift o'lchamlari. */
export const F = {
  hero: 40, // yakuniy narx — ekrandagi eng katta son
  display: 32,
  title: 22, // panel sarlavhasi ("Taksi qidirilmoqda...")
  h2: 20, // asosiy tugma matni
  h3: 17, // toifa nomi, maydon qiymati
  body: 15, // "Yo'lovchilar soni:", ajratkich
  label: 13,
  tiny: 11, // toifa narxi, tugma ostidagi izoh
};

/** Bo'shliq shkalasi. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

/** Birlamchi tugma balandligi — bir qo'l bilan bosiladi. */
const TAP = 56;

/**
 * Ko'tarilgan yuza soyasi. Oq dizaynda kartalar FAQAT soya bilan ajraladi
 * (qorong'ida fon farqi yetardi), shuning uchun bu bezak emas.
 */
export const shadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
}) as object;

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, padding: SP.xl },
  center: { flex: 1, justifyContent: 'center' },

  title: { color: C.text, fontSize: F.title, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: C.muted, fontSize: 15, marginBottom: SP.xl, lineHeight: 22 },
  label: { color: C.muted, fontSize: F.label, marginBottom: 6 },

  input: {
    backgroundColor: C.panel2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.md,
    color: C.text,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.lg,
    fontSize: F.body,
    marginBottom: SP.lg,
  },

  btn: {
    backgroundColor: C.accent,
    borderRadius: R.md,
    minHeight: TAP,
    flexDirection: 'row', // ikonka + matn yonma-yon
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
  },
  btnText: { color: '#FFFFFF', fontSize: F.body, fontWeight: '700' },
  btnGhost: {
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.md,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.md,
  },
  btnGhostText: { color: C.text, fontSize: 15, fontWeight: '600' },
  btnOk: { backgroundColor: C.ok },
  btnOkText: { color: C.onOk, fontSize: F.h3, fontWeight: '800' },
  btnDanger: { backgroundColor: C.dangerSolid },

  card: {
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.lg,
    padding: 18,
  },

  err: { color: C.danger, fontSize: F.label, marginBottom: SP.md },
  /** Xato bloki — popup emas, ekranda turadi (diagnostika uchun muhim). */
  errBox: {
    backgroundColor: C.dangerSoft,
    borderColor: 'rgba(217, 45, 32, 0.25)',
    borderWidth: 1,
    borderRadius: R.sm,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
  },

  row: { flexDirection: 'row', alignItems: 'center' },

  /** Yuqori panel: logo + o'ng tomonda amallar. */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.xl,
    paddingVertical: SP.md,
    backgroundColor: C.panel,
    borderBottomColor: C.border,
    borderBottomWidth: 1,
  },
  brand: { color: C.text, fontSize: F.h2, fontWeight: '800', letterSpacing: 0.2 },

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
