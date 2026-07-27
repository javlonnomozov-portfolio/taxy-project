import { Candidate, haversineM, sortCandidates, RATING_BUCKET_M } from './dispatch.util';

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
