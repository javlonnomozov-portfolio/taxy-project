import { BillingMode } from '@tty/shared';
import { BillingService } from './billing.service';
import { Driver } from '../entities/driver.entity';

const driver = (mode: BillingMode, config?: Record<string, unknown>): Driver =>
  ({ id: 'd1', billingMode: mode, billingConfig: config ?? null, balance: 0 }) as unknown as Driver;

// computeCommission sof funksiya — repozitoriysiz ishlaydi.
const svc = new BillingService(
  null as never,
  null as never,
  null as never,
  null as never,
);

describe('BillingService — har zakaz uchun qat\'iy to\'lov (per_order)', () => {
  it('tizim sozlamasidagi summani oladi', () => {
    expect(svc.computeCommission(driver(BillingMode.PER_ORDER), 50000, 1500)).toBe(1500);
  });

  it('summa safar narxiga BOG\'LIQ EMAS', () => {
    const a = svc.computeCommission(driver(BillingMode.PER_ORDER), 5000, 1500);
    const b = svc.computeCommission(driver(BillingMode.PER_ORDER), 500000, 1500);
    expect(a).toBe(b);
  });

  it('haydovchi darajasidagi kelishuv tizim sozlamasidan USTUN', () => {
    expect(svc.computeCommission(driver(BillingMode.PER_ORDER, { perOrder: 500 }), 50000, 1500)).toBe(500);
  });

  it('haydovchi uchun 0 kelishilgan bo\'lsa — hech narsa yechilmaydi', () => {
    expect(svc.computeCommission(driver(BillingMode.PER_ORDER, { perOrder: 0 }), 50000, 1500)).toBe(0);
  });

  it('sozlama berilmasa 0 (kutilmagan pul yechilmasin)', () => {
    expect(svc.computeCommission(driver(BillingMode.PER_ORDER), 50000)).toBe(0);
  });

  it('manfiy sozlama pul QO\'SHIB yubormaydi', () => {
    expect(svc.computeCommission(driver(BillingMode.PER_ORDER), 50000, -900)).toBe(0);
  });
});

describe('BillingService.computeCommission', () => {
  it('OBUNA rejimida per-safar komissiya yo‘q', () => {
    expect(svc.computeCommission(driver(BillingMode.SUBSCRIPTION), 20000)).toBe(0);
  });

  it('FOIZ rejimida sozlangan foizni oladi', () => {
    expect(svc.computeCommission(driver(BillingMode.PERCENT, { percent: 15 }), 20000)).toBe(3000);
  });

  it('GIBRID rejimi ham foiz bo‘yicha hisoblaydi', () => {
    expect(svc.computeCommission(driver(BillingMode.HYBRID, { percent: 10 }), 20000)).toBe(2000);
  });

  it('foiz ko‘rsatilmasa default 10% ishlatiladi', () => {
    expect(svc.computeCommission(driver(BillingMode.PERCENT), 20000)).toBe(2000);
  });

  it('billingConfig null bo‘lsa yiqilmaydi', () => {
    expect(svc.computeCommission(driver(BillingMode.PERCENT, undefined), 10000)).toBe(1000);
  });

  it('butun songa yaxlitlaydi (tiyin qolmaydi)', () => {
    // 12345 × 10% = 1234.5 → 1235
    expect(svc.computeCommission(driver(BillingMode.PERCENT, { percent: 10 }), 12345)).toBe(1235);
  });

  it('0 so‘mlik safardan komissiya 0', () => {
    expect(svc.computeCommission(driver(BillingMode.PERCENT, { percent: 20 }), 0)).toBe(0);
  });

  it('0% sozlansa komissiya olinmaydi', () => {
    expect(svc.computeCommission(driver(BillingMode.PERCENT, { percent: 0 }), 50000)).toBe(0);
  });
});
