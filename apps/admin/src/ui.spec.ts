import { describe, expect, it } from 'vitest';
import { money, time } from './ui';

describe('money', () => {
  it('summani ajratuvchi bilan formatlaydi', () => {
    expect(money(14000)).toContain('14');
    expect(money(14000)).toContain("so'm");
  });

  it('null/undefined da chiziqcha (NaN emas)', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
  });

  it('nolni ko\'rsatadi (chiziqcha emas) — bepul safar ham summa', () => {
    expect(money(0)).toContain('0');
    expect(money(0)).not.toBe('—');
  });
});

describe('time', () => {
  it('null da chiziqcha', () => {
    expect(time(null)).toBe('—');
    expect(time(undefined)).toBe('—');
  });

  it('ISO sanani o\'qiladigan ko\'rinishga o\'giradi', () => {
    const s = time('2026-07-27T10:30:00.000Z');
    expect(s).not.toBe('—');
    expect(s.length).toBeGreaterThan(4);
  });
});
