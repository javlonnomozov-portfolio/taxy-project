import { VehicleCategory } from '@tty/shared';
import {
  Candidate,
  haversineM,
  canSuggestStandard,
  servedCategories,
  servingVehicles,
  standardSuggestAt,
  sortCandidates,
  RATING_BUCKET_M,
} from './dispatch.util';

describe('haversineM', () => {
  it('bir xil nuqta uchun 0 qaytaradi', () => {
    expect(haversineM(39.7683, 67.2792, 39.7683, 67.2792)).toBe(0);
  });

  it('taxminan to‘g‘ri masofani hisoblaydi (1 kenglik daraja ≈ 111 km)', () => {
    const d = haversineM(39.0, 67.0, 40.0, 67.0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('simmetrik (A→B = B→A)', () => {
    expect(haversineM(39.76, 67.27, 39.8, 67.3)).toBe(haversineM(39.8, 67.3, 39.76, 67.27));
  });

  it('butun songa yaxlitlaydi', () => {
    expect(Number.isInteger(haversineM(39.7683, 67.2792, 39.7695, 67.2801))).toBe(true);
  });
});

describe('sortCandidates — masofa + reyting tie-break (2.4)', () => {
  const ratings: Record<string, number> = { a: 4.9, b: 3.1, c: 5.0, d: 0 };
  const ratingOf = (id: string) => ratings[id] ?? 0;

  it('bucket ICHIDA yuqori reytingli oldinroq turadi', () => {
    // 100 va 150 m — ikkalasi ham 0-bucket (200 m ga yaxlitlanadi).
    const list: Candidate[] = [
      { driverId: 'b', distanceM: 100 }, // yaqinroq, lekin past reyting
      { driverId: 'a', distanceM: 150 },
    ];
    expect(sortCandidates(list, ratingOf).map((c) => c.driverId)).toEqual(['a', 'b']);
  });

  it('bucket TASHQARISIDA masofa hal qiladi (reyting ustun kelmaydi)', () => {
    // 100 m → bucket 1 (0.5 yaxlitlanadi), 900 m → bucket 5 — turli bucket.
    const list: Candidate[] = [
      { driverId: 'c', distanceM: 900 }, // eng yuqori reyting, lekin ancha uzoq
      { driverId: 'b', distanceM: 100 },
    ];
    expect(sortCandidates(list, ratingOf).map((c) => c.driverId)).toEqual(['b', 'c']);
  });

  it('reyting ham teng bo‘lsa — aniq masofa bo‘yicha', () => {
    const equal = (): number => 4.0;
    const list: Candidate[] = [
      { driverId: 'x', distanceM: 180 },
      { driverId: 'y', distanceM: 120 },
    ];
    expect(sortCandidates(list, equal).map((c) => c.driverId)).toEqual(['y', 'x']);
  });

  it('reytingsiz (0) haydovchi reytinglisidan keyin turadi', () => {
    const list: Candidate[] = [
      { driverId: 'd', distanceM: 50 }, // reyting 0
      { driverId: 'a', distanceM: 60 }, // reyting 4.9
    ];
    expect(sortCandidates(list, ratingOf).map((c) => c.driverId)).toEqual(['a', 'd']);
  });

  it('bo‘sh va bitta elementli ro‘yxatda yiqilmaydi', () => {
    expect(sortCandidates([], ratingOf)).toEqual([]);
    const one: Candidate[] = [{ driverId: 'a', distanceM: 10 }];
    expect(sortCandidates(one, ratingOf)).toHaveLength(1);
  });

  it('bucket kengligi hujjatlashtirilgan qiymatga mos (200 m)', () => {
    expect(RATING_BUCKET_M).toBe(200);
  });
});

describe('servedCategories — qaysi mashina qaysi zakazni oladi', () => {
  it('Comfort mashina Standart zakazni ham oladi', () => {
    expect(servedCategories(VehicleCategory.COMFORT)).toEqual([
      VehicleCategory.COMFORT,
      VehicleCategory.STANDARD,
    ]);
  });

  it('Standart mashina Comfort zakazni OLMAYDI (bir tomonlama)', () => {
    expect(servedCategories(VehicleCategory.STANDARD)).toEqual([VehicleCategory.STANDARD]);
  });

  it('Yuk mashinasi alohida — boshqa toifa aralashmaydi', () => {
    expect(servedCategories(VehicleCategory.CARGO)).toEqual([VehicleCategory.CARGO]);
    for (const v of Object.values(VehicleCategory)) {
      if (v !== VehicleCategory.CARGO) {
        expect(servedCategories(v)).not.toContain(VehicleCategory.CARGO);
      }
    }
  });

  it("har mashina o'z toifasini albatta oladi", () => {
    for (const v of Object.values(VehicleCategory)) {
      expect(servedCategories(v)).toContain(v);
    }
  });
});

describe('servingVehicles — teskari qidiruv', () => {
  it('Standart zakazni Standart ham, Comfort ham oladi', () => {
    expect(servingVehicles(VehicleCategory.STANDARD).sort()).toEqual(
      [VehicleCategory.STANDARD, VehicleCategory.COMFORT].sort(),
    );
  });

  it('Comfort zakazni faqat Comfort oladi', () => {
    expect(servingVehicles(VehicleCategory.COMFORT)).toEqual([VehicleCategory.COMFORT]);
  });

  it('ikki funksiya bir-biriga MOS (har juftlik uchun)', () => {
    for (const vehicle of Object.values(VehicleCategory)) {
      for (const order of Object.values(VehicleCategory)) {
        expect(servedCategories(vehicle).includes(order)).toBe(
          servingVehicles(order).includes(vehicle),
        );
      }
    }
  });
});

describe('Standart taklifi — qachon chiqadi', () => {
  const created = new Date('2026-09-15T08:00:00Z');
  const at = (sec: number) => new Date(created.getTime() + sec * 1000);
  const order = (status: string, vehicleCategory = 'comfort') => ({ status, vehicleCategory, createdAt: created });

  it('Comfort qidirilayotganda 60 soniyadan KEYIN chiqadi, oldin emas', () => {
    expect(canSuggestStandard(order('DISPATCHING'), at(59))).toBe(false);
    expect(canSuggestStandard(order('DISPATCHING'), at(60))).toBe(true);
    expect(standardSuggestAt(order('DISPATCHING'))?.toISOString()).toBe(at(60).toISOString());
  });

  it('qidiruv to‘xtagan (NO_DRIVER) bo‘lsa darhol', () => {
    expect(canSuggestStandard(order('NO_DRIVER'), at(1))).toBe(true);
  });

  it('Standart zakazda va topilgan/tugagan zakazda umuman yo‘q', () => {
    expect(standardSuggestAt(order('DISPATCHING', 'standard'))).toBeNull();
    expect(standardSuggestAt(order('ACCEPTED'))).toBeNull();
    expect(standardSuggestAt(order('COMPLETED'))).toBeNull();
  });

  it('chegara sozlanadi', () => {
    expect(canSuggestStandard(order('DISPATCHING'), at(5), 4)).toBe(true);
    expect(canSuggestStandard(order('DISPATCHING'), at(3), 4)).toBe(false);
  });
});
