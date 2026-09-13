import { ConfigService } from '@nestjs/config';
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
    surgeMultiplier: 1.0,
    category: VehicleCategory.STANDARD,
    ...over,
  }) as Tariff;

/**
 * `surge` endi TARIFDA turadi (`tariffs.surge_multiplier`), servis esa faqat
 * bosh kalitni so'raydi. Testlar qulay bo'lishi uchun bu yordamchi ikkalasini
 * ham o'rnatadi: koeffitsient 1 dan farq qilsa — kalit yoqiladi.
 */
function makeService(t: Tariff | null, surge = 1, maxWait = 30) {
  const withSurge = t ? ({ ...t, surgeMultiplier: surge } as Tariff) : t;
  const settings = {
    getTariff: jest.fn().mockResolvedValue(withSurge),
    surgeActive: jest.fn().mockResolvedValue(surge !== 1),
  } as unknown as SettingsService;
  const config = { get: jest.fn().mockReturnValue(maxWait) } as unknown as ConfigService;
  return new PricingService(settings, config);
}

// Kunduzi (tungi tarif tushmasligi uchun)
const DAY = new Date('2026-07-27T12:00:00');

describe('kutish haqi chegarasi', () => {
  it('chegaradan oshgan kutish uchun pul olinmaydi', async () => {
    // 3 daq bepul, 500/daq, chegara 30 daq → ko'pi bilan (30-3)*500 = 13 500
    const fare = await makeService(tariff(), 1, 30).computeFare(
      VehicleCategory.STANDARD, 0, 120, DAY,
    );
    expect(fare.waiting).toBe(13500);
  });

  it('chegaradan past kutish odatdagidek hisoblanadi', async () => {
    const fare = await makeService(tariff(), 1, 30).computeFare(
      VehicleCategory.STANDARD, 0, 10, DAY,
    );
    expect(fare.waiting).toBe(3500); // (10-3) * 500
  });

  it('chegara bepul daqiqalardan kichik bo\'lsa manfiy chiqmaydi', async () => {
    const fare = await makeService(tariff(), 1, 2).computeFare(
      VehicleCategory.STANDARD, 0, 60, DAY,
    );
    expect(fare.waiting).toBe(0);
  });
});

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

describe('toifa bo\u2018yicha surge', () => {
  it('bosh kalit o\u2018chiq bo\u2018lsa tarifdagi koeffitsient QO\u2018LLANMAYDI', async () => {
    const settings = {
      getTariff: jest.fn().mockResolvedValue(tariff({ surgeMultiplier: 2 })),
      surgeActive: jest.fn().mockResolvedValue(false),
    } as unknown as SettingsService;
    const config = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;
    const fare = await new PricingService(settings, config).computeFare(
      VehicleCategory.STANDARD, 0, 0, DAY,
    );
    expect(fare.surgeMultiplier).toBe(1);
    expect(fare.total).toBe(4000);
  });

  it('kalit yoqilganda AYNAN shu tarifning koeffitsienti qo\u2018llanadi', async () => {
    const settings = {
      getTariff: jest.fn().mockResolvedValue(tariff({ surgeMultiplier: 1.5 })),
      surgeActive: jest.fn().mockResolvedValue(true),
    } as unknown as SettingsService;
    const config = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;
    const fare = await new PricingService(settings, config).computeFare(
      VehicleCategory.STANDARD, 0, 0, DAY,
    );
    expect(fare.surgeMultiplier).toBe(1.5);
    expect(fare.total).toBe(6000);
  });

  it('koeffitsient buzuq bo\u2018lsa 1 ga tushadi (narx nolga aylanmasin)', async () => {
    const settings = {
      getTariff: jest.fn().mockResolvedValue(tariff({ surgeMultiplier: 0 as number })),
      surgeActive: jest.fn().mockResolvedValue(true),
    } as unknown as SettingsService;
    const config = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService;
    const fare = await new PricingService(settings, config).computeFare(
      VehicleCategory.STANDARD, 0, 0, DAY,
    );
    expect(fare.surgeMultiplier).toBe(1);
    expect(fare.total).toBe(4000);
  });
});
