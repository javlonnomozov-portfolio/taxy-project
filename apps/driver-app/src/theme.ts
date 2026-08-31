import { Platform, StyleSheet } from 'react-native';

// Dizayn tokenlari — 2026-08-22 maketidan (oq fon + yashil aksent),
// mijoz ilovasi bilan bir xil (CUSTOMER-APP dizayni, 2026-08-23 da
// haydovchi ilovasiga ham ko'chirildi — foydalanuvchi so'rovi bilan).
// Aniq eksport (HEX/Figma) kelganda FAQAT shu fayl yangilanadi, ekranlarga tegilmaydi.

export const C = {
  bg: '#F7F8FA', // eng orqa fon — deyarli oq, kartalar ajralib tursin
  panel: '#FFFFFF', // karta
  panel2: '#F1F3F6', // ko'tarilgan yuza: input, chip, tab
  border: '#E4E7EC',
  text: '#101828',
  muted: '#667085',

  accent: '#00B14F', // brend yashili — havolalar, tanlangan holat
  accentSoft: 'rgba(0, 177, 79, 0.10)', // yashil fon (tanlangan toifa, ikonka doirasi)

  ok: '#00B14F', // birlamchi amal ("Qabul qilish")
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

/** Shrift o'lchamlari. */
export const F = {
  hero: 44, // taksometr, yakuniy narx — ekrandagi eng katta son
  display: 32,
  title: 28,
  h2: 20,
  h3: 17,
  body: 16,
  label: 13,
  tiny: 11,
};

/** Bo'shliq shkalasi. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

/** Haydovchi mashinada, quyoshda, bir qo'l bilan bosadi — birlamchi tugma balandligi. */
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

  /** Holat yorlig'i ("ONLAYN"), yumaloq. */
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
