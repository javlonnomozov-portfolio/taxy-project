import { StyleSheet } from 'react-native';

// Dizayn tokenlari — Figma "Toy taxi" maketidan (node 111:378, 2026-08-21).
// Rang/o'lcham o'zgarsa FAQAT shu fayl tahrirlanadi.
//
// DIQQAT: mijoz ilovasi OCH temada, haydovchi ilovasi esa TO'Q temada.
// Ular ataylab boshqacha — `driver-app/src/theme.ts` bilan aralashtirmang.

export const C = {
  bg: '#FFFFFF',
  sheet: '#FFFFFF', // xarita ustidagi pastki karta
  text: '#171E2A',
  muted: 'rgba(23, 30, 42, 0.5)',
  border: '#999999',

  /** Asosiy amal — "Taksi chaqirish". */
  primary: '#0CAF50',
  primarySoft: '#E4F6EB', // tanlangan toifa kartasi foni
  onPrimary: '#FFFFFF',

  /** Yo'lovchilar soni tanlagichi. */
  accent: '#F68F0A',
  onAccent: '#FFFFFF',

  danger: '#E5484D',
  dangerSoft: 'rgba(229, 72, 77, 0.10)',
  cardBg: '#FBFBFB',
  mapBg: '#EDEDED',

  // `MapView` va `ErrorBoundary` haydovchi ilovasi bilan BIR XIL fayl —
  // ular faqat shu tokenlar orqali temaga bog'lanadi. Shuning uchun nomlar
  // o'sha-o'sha qoladi, qiymatlar esa och temaga moslangan: fayllarni
  // tahrirlasak, bir ilovadagi tuzatish ikkinchisiga o'tmay qolardi.
  chrome: 'rgba(255, 255, 255, 0.94)', // xarita ustidagi tugma foni
  panel: '#F5F5F5', // xato bloki foni
};

export const R = { sm: 12, md: 14, lg: 20, xl: 23, card: 14, pill: 999 };

/** Shrift o'lchamlari — maketdagi 1080px kenglikdan 3x ga bo'lingan. */
export const F = {
  hero: 25, // "Taksi chaqirish"
  h2: 20, // `ErrorBoundary` ishlatadi (haydovchi ilovasi bilan umumiy fayl)
  title: 20,
  h3: 17,
  body: 16,
  label: 15,
  small: 13,
  tiny: 11,
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

const TAP = 56;

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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
  },
  btnText: { color: C.onPrimary, fontSize: F.body, fontWeight: '800' },

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

  /** Xarita ustida turadigan pastki karta. */
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: SP.md,
    paddingTop: SP.lg,
    paddingBottom: SP.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
});
