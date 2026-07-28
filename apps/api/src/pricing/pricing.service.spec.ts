import { VehicleCategory } from '@tty/shared';
import { PricingService } from './pricing.service';
import { SettingsService } from '../settings/settings.service';
import { Tariff } from '../entities/tariff.entity';

// Standart tarif: 4000 base, 2000/km, 500/daq kutish, 3 daq bepul, 22:00–06:00 tungi ×1.2
const tariff = (over: Partial<Tariff> = {}): Tariff =>
  ({
    baseFare: 4000,
    perKm: 2000,
    waitingPerMin: 500,
    freeWaitMin: 3,
    nightFrom: '22:00',
    nightTo: '06:00',
    nightMultiplier: 1.2,
    category: VehicleCategory.STANDARD,
    ...over,
  }) as Tariff;

function makeService(t: Tariff | null, surge = 1) {
  const settings = {
    getTariff: jest.fn().mockResolvedValue(t),
    currentSurge: jest.fn().mockResolvedValue(surge),
  } as unknown as SettingsService;
  return new PricingService(settings);
}

// Kunduzi (tungi tarif tushmasligi uchun)
const DAY = new Date('2026-07-27T12:00:00');

describe('PricingService.computeFare', () => {
  it('base + masofa narxini qo‘shadi', async () => {
    const fare = await makeService(tariff()).computeFare(VehicleCategory.STANDARD, 5000, 0, DAY);
    expect(fare.base).toBe(4000);
    expect(fare.distance).toBe(10000); // 2000 × 5 km
    expect(fare.subtotal).toBe(14000);
    expect(fare.total).toBe(14000);
  });

  it('BEPUL kutish daqiqalari hisoblanmaydi', async () => {
    const fare = await makeService(tariff()).computeFare(VehicleCategory.STANDARD, 0, 3, DAY);
    expect(fare.waiting).toBe(0);
    expect(fare.total).toBe(4000);
  });

  it('bepul oynadan oshgan kutish uchungina haq oladi', async () => {
    // 8 daqiqa kutish − 3 bepul = 5 × 500 = 2500
    const fare = await makeService(tariff()).computeFare(VehicleCategory.STANDARD, 0, 8, DAY);
    expect(fare.waiting).toBe(2500);
    expect(fare.total).toBe(6500);
  });

  it('kutish bepul oynadan kam bo‘lsa manfiy haq chiqmaydi', async () => {
    const fare = await makeService(tariff()).computeFare(VehicleCategory.STANDARD, 0, 1, DAY);
    expect(fare.waiting).toBe(0);
  });

  it('tungi koeffitsientni qo‘llaydi', async () => {
    const night = new Date('2026-07-27T23:30:00');
    const fare = await makeService(tariff()).computeFare(VehicleCategory.STANDARD, 5000, 0, night);
    expect(fare.nightMultiplier).toBe(1.2);
    expect(fare.total).toBe(Math.round(14000 * 1.2)); // 16800
  });

  it('surge koeffitsientini qo‘llaydi', async () => {
    const fare = await makeService(tariff(), 1.5).computeFare(VehicleCategory.STANDARD, 5000, 0, DAY);
    expect(fare.surgeMultiplier).toBe(1.5);
    expect(fare.total).toBe(21000);
  });

  it('tungi va surge birga ko‘paytiriladi', async () => {
    const night = new Date('2026-07-27T23:00:00');
    const fare = await makeService(tariff(), 1.5).computeFare(VehicleCategory.STANDARD, 5000, 0, night);
    expect(fare.total).toBe(Math.round(14000 * 1.2 * 1.5)); // 25200
  });

  it('yakuniy narx butun songa yaxlitlanadi', async () => {
    const fare = await makeService(tariff({ perKm: 1333 })).computeFare(
      VehicleCategory.STANDARD, 1234, 0, DAY,
    );
    expect(Number.isInteger(fare.total)).toBe(true);
  });

  it('tarif topilmasa — faqat bazaviy 4000', async () => {
    const fare = await makeService(null).computeFare(VehicleCategory.STANDARD, 99999, 99, DAY);
    expect(fare.total).toBe(4000);
    expect(fare.distance).toBe(0);
    expect(fare.waiting).toBe(0);
  });
});

describe('PricingService.isNight — yarim tunni o‘rab o‘tish', () => {
  const svc = makeService(tariff());
  const at = (hhmm: string) => new Date(`2026-07-27T${hhmm}:00`);

  it('tungi oraliq boshlanishida (22:00) — tungi', () => {
    expect(svc.isNight(tariff(), at('22:00'))).toBe(true);
  });

  it('yarim tundan keyin (02:00) — tungi', () => {
    expect(svc.isNight(tariff(), at('02:00'))).toBe(true);
  });

  it('tugash chegarasi (06:00) — tungi EMAS', () => {
    expect(svc.isNight(tariff(), at('06:00'))).toBe(false);
  });

  it('kunduzi (12:00) — tungi emas', () => {
    expect(svc.isNight(tariff(), at('12:00'))).toBe(false);
  });

  it('yarim tunni o‘ramaydigan oraliq ham to‘g‘ri ishlaydi (01:00–05:00)', () => {
    const t = tariff({ nightFrom: '01:00', nightTo: '05:00' });
    expect(svc.isNight(t, at('03:00'))).toBe(true);
    expect(svc.isNight(t, at('23:00'))).toBe(false);
  });
});
