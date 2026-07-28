import { normalizePhone } from './bot';

describe('normalizePhone', () => {
  it('9 xonali raqamga +998 qo\'shadi', () => {
    expect(normalizePhone('901234567')).toBe('+998901234567');
  });

  it('998 bilan boshlangan to\'liq raqamni qabul qiladi', () => {
    expect(normalizePhone('998901234567')).toBe('+998901234567');
    expect(normalizePhone('+998901234567')).toBe('+998901234567');
  });

  it('ajratuvchilarni (probel, tire, qavs) e\'tiborsiz qoldiradi', () => {
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567');
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
  });

  it('noto\'g\'ri uzunlikda null qaytaradi', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('9012345678')).toBeNull(); // 10 xona
    expect(normalizePhone('9989012345678')).toBeNull(); // ortiqcha
  });

  it('raqamsiz matnda null qaytaradi', () => {
    expect(normalizePhone('salom')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});
