import { describe, expect, it } from 'vitest';
import { translate } from './i18n';

describe('translate', () => {
  it('tanlangan tildagi matnni beradi', () => {
    expect(translate('uz', 'nav_orders')).toBe('Zakazlar');
    expect(translate('ru', 'nav_orders')).toBe('Заказы');
  });

  it('noma\'lum kalitda kalitning o\'zini qaytaradi (bo\'sh matn emas)', () => {
    expect(translate('uz', 'yoq_kalit')).toBe('yoq_kalit');
    expect(translate('ru', 'yoq_kalit')).toBe('yoq_kalit');
  });

  it('til almashtirish tugmasi qarama-qarshi tilni ko\'rsatadi', () => {
    expect(translate('uz', 'lang_switch')).toBe('Русский');
    expect(translate('ru', 'lang_switch')).toBe('O‘zbekcha');
  });
});

describe('lug\'atlar to\'liqligi', () => {
  // Tarjima unutilsa foydalanuvchi kalit nomini ko'radi — buni test ushlaydi.
  const keys = [
    'nav_dashboard', 'nav_orders', 'nav_customers', 'nav_scheduled', 'nav_drivers', 'nav_settings',
    'sign_in', 'login', 'password', 'logout', 'save', 'cancel', 'close', 'confirm', 'error',
    'dashboard_title', 'orders_title', 'customers_title', 'scheduled_title', 'settings_title',
    'drivers_title', 'stat_active_orders', 'stat_online_drivers', 'stat_alerts',
    'm_total_24h', 'm_no_driver', 'm_completed', 'm_accept_time', 'm_avg_fare',
    'th_status', 'th_category', 'th_price', 'th_created', 'th_name', 'th_phone',
    'approve', 'block', 'topup', 'add', 'no_orders', 'no_drivers', 'no_customers',
  ];

  it.each(['uz', 'ru'] as const)('%s lug\'atida barcha asosiy kalitlar bor', (lang) => {
    const missing = keys.filter((k) => translate(lang, k) === k);
    expect(missing).toEqual([]);
  });

  it('uz va ru tarjimalari bir-biridan farq qiladi (nusxa ko\'chirilmagan)', () => {
    // Ba'zi kalitlar ikkala tilda bir xil bo'lishi mumkin (KYC, Billing) — ularni chiqaramiz.
    const sameOk = new Set(['th_kyc']);
    const identical = keys.filter(
      (k) => !sameOk.has(k) && translate('uz', k) === translate('ru', k),
    );
    expect(identical).toEqual([]);
  });
});
