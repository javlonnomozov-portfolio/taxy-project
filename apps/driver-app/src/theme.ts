import { StyleSheet } from 'react-native';

// Dizayn tokenlari — Google Stitch maketlaridan olingan (2026-07-29).
// Aniq eksport (HEX/Figma) kelganda FAQAT shu fayl yangilanadi, ekranlarga tegilmaydi.

export const C = {
  bg: '#0A0F1E', // eng orqa fon — chuqur navy
  panel: '#131B2E', // karta
  panel2: '#1B2438', // ko'tarilgan yuza: input, chip, tab
  border: '#24304A',
  text: '#E8EDF7',
  muted: '#8B98B4',

  accent: '#5B8DEF', // asosiy ko'k — brend, havolalar, birlamchi tugma
  accentSoft: 'rgba(91, 141, 239, 0.14)', // ko'k fon (bosilgan tab, ikonka doirasi)

  ok: '#00C853', // "Qabul qilish" / yakunlash — yorqin yashil
  onOk: '#062713', // yashil ustidagi matn (qora-yashil, oq emas)
  okSoft: 'rgba(0, 200, 83, 0.12)',
  online: '#3DDC84', // "Onlayn" status rangi (tugmadan farqli, yumshoqroq)

  danger: '#FF7B72', // xato matni va ramka (marjon)
  dangerSolid: '#E5484D', // to'ldirilgan qizil tugma ("Ishni tugatish")
  dangerSoft: 'rgba(229, 72, 77, 0.12)',

  warn: '#FFB020', // "Ulanmoqda…", taymer ogohlantirishi
  warnSoft: 'rgba(255, 176, 32, 0.12)',
  gold: '#FFC53D', // reyting yulduzi
};

/** Burchak radiuslari. */
export const R = { sm: 10, md: 14, lg: 16, xl: 20, pill: 999 };

/** Shrift o'lchamlari. */
export const F = {
  hero: 44, // taksometr, yakuniy narx — ekrandagi eng katta son
  display: 32, // "Xush kelibsiz!"
  title: 24,
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

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, padding: SP.xl },
  center: { flex: 1, justifyContent: 'center' },

  title: { color: C.text, fontSize: F.title, fontWeight: '700', marginBottom: 6 },
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
    flexDirection: 'row', // ikonka + matn yonma-yon turishi uchun
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
  },
  btnText: { color: '#FFFFFF', fontSize: F.body, fontWeight: '700' },
  btnGhost: {
    backgroundColor: C.panel2,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.md,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.md,
  },
  btnGhostText: { color: C.text, fontSize: 15, fontWeight: '600' },
  // Yashil ustida OQ emas, to'q matn — yorqin yashilda kontrast shunda yuqori.
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
    borderColor: 'rgba(229, 72, 77, 0.35)',
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
    borderBottomColor: C.border,
    borderBottomWidth: 1,
  },
  brand: { color: C.accent, fontSize: F.h2, fontWeight: '800', letterSpacing: 0.2 },

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
