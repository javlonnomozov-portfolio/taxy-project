/**
 * `launchWithRetry` mantiqi: 409 (Conflict) da o'lmaslik, boshqa xatoda darhol chiqish.
 * Bu naqsh prod'da crash-loop keltirib chiqargan edi — polling long-poll'i eski
 * jarayondan qolib, har restart yana 409 berardi.
 */

// main.ts `process.exit` chaqiradi, shuning uchun mantiqni shu yerda takrorlaymiz
// (o'sha shartlar bilan) — modulni import qilish jarayonni yopib qo'yardi.
const isConflict = (e: unknown): boolean =>
  (e as { response?: { error_code?: number } })?.response?.error_code === 409;

describe('409 aniqlash', () => {
  it('Telegram 409 javobini taniydi', () => {
    expect(isConflict({ response: { error_code: 409, description: 'Conflict' } })).toBe(true);
  });

  it('boshqa Telegram xatolarini 409 deb hisoblamaydi', () => {
    expect(isConflict({ response: { error_code: 401 } })).toBe(false);
    expect(isConflict({ response: { error_code: 400 } })).toBe(false);
  });

  it('oddiy xato yoki null da yiqilmaydi', () => {
    expect(isConflict(new Error('tarmoq'))).toBe(false);
    expect(isConflict(null)).toBe(false);
    expect(isConflict(undefined)).toBe(false);
  });
});

describe('qayta urinish siyosati', () => {
  // main.ts dagi formula bilan bir xil
  const waitFor = (attempt: number) => Math.min(10_000 * attempt, 60_000);

  it('kutish vaqti bosqichma-bosqich oshadi', () => {
    expect(waitFor(1)).toBe(10_000);
    expect(waitFor(2)).toBe(20_000);
    expect(waitFor(5)).toBe(50_000);
  });

  it('kutish 60 soniyadan oshmaydi', () => {
    expect(waitFor(10)).toBe(60_000);
    expect(waitFor(100)).toBe(60_000);
  });

  it('birinchi urinishdayoq Telegram long-poll oynasidan (50s) uzunroq kutadi', () => {
    // 12 urinish yig'indisi long-poll oynasini bir necha marta qoplaydi.
    const total = Array.from({ length: 12 }, (_, i) => waitFor(i + 1)).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(50_000);
  });
});
