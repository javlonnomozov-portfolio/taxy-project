import { t } from './i18n';

describe('i18n t()', () => {
  it('tanlangan tildagi matnni beradi', () => {
    expect(t('uz', 'menu_order')).toContain('Taksi');
    expect(t('ru', 'menu_order')).not.toBe(t('uz', 'menu_order'));
  });

  it('kalit ru\'da bo\'lmasa uz\'ga qaytadi (bo\'sh matn ko\'rsatmaydi)', () => {
    // `dicts.ru` da yo'q kalit — uz'dagi qiymat qaytishi kerak.
    const ru = t('ru', 'welcome');
    expect(ru.length).toBeGreaterThan(0);
  });

  it('noma\'lum kalitda kalitning o\'zini qaytaradi (jimgina bo\'sh emas)', () => {
    expect(t('uz', 'umuman_yoq_kalit')).toBe('umuman_yoq_kalit');
  });

  it('parametrli matnlarni to\'ldiradi', () => {
    const s = t('uz', 'ago_sec', '42');
    expect(s).toContain('42');
  });

  it('uz va ru uchun asosiy menyu kalitlari to\'liq', () => {
    for (const key of ['menu_order', 'menu_lang', 'cancel', 'skip', 'registered']) {
      expect(t('uz', key)).not.toBe(key);
      expect(t('ru', key)).not.toBe(key);
    }
  });
});
