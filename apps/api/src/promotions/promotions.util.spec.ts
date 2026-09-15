import { PromoRule, appliesTo, discounted, isLive, pickBenefit, promoState } from './promotions.util';

const NOW = new Date('2026-12-15T12:00:00Z');
const day = 24 * 3600_000;

const promo = (over: Partial<PromoRule> = {}): PromoRule => ({
  id: 'p1',
  name: 'Yangi yil',
  active: true,
  startsAt: null,
  endsAt: null,
  groupId: null,
  commissionDiscountPercent: 100,
  bonusPerOrder: 300,
  ...over,
});

describe('promoState / isLive — qachon ishlaydi', () => {
  it('sanasiz va yoqilgan — ishlaydi', () => {
    expect(promoState(promo(), NOW)).toBe('live');
  });

  it('qo‘lda o‘chirilgan bo‘lsa sanadan qat’i nazar ishlamaydi', () => {
    expect(promoState(promo({ active: false }), NOW)).toBe('off');
  });

  it('boshlanishi hali kelmagan — rejalashtirilgan', () => {
    expect(promoState(promo({ startsAt: new Date(NOW.getTime() + day) }), NOW)).toBe('scheduled');
  });

  it('tugash vaqti o‘tgan — o‘zi to‘xtagan', () => {
    expect(promoState(promo({ endsAt: new Date(NOW.getTime() - 1) }), NOW)).toBe('ended');
  });

  it('tugash vaqtining AYNAN o‘zida endi ishlamaydi (chegara kirmaydi)', () => {
    expect(isLive(promo({ endsAt: NOW }), NOW)).toBe(false);
    expect(isLive(promo({ endsAt: new Date(NOW.getTime() + 1) }), NOW)).toBe(true);
  });

  it('oraliq ichida ishlaydi', () => {
    expect(isLive(promo({ startsAt: new Date(NOW.getTime() - day), endsAt: new Date(NOW.getTime() + day) }), NOW)).toBe(true);
  });
});

describe('appliesTo — kimga tegadi', () => {
  it('guruhsiz aksiya hammaga', () => {
    expect(appliesTo(promo({ groupId: null }), new Set())).toBe(true);
  });

  it('guruh aksiyasi faqat a’zolarga', () => {
    expect(appliesTo(promo({ groupId: 'g1' }), new Set(['g1', 'g2']))).toBe(true);
    expect(appliesTo(promo({ groupId: 'g1' }), new Set(['g2']))).toBe(false);
  });
});

describe('pickBenefit — bir nechta aksiya', () => {
  it('QO‘SHILMAYDI: eng katta chegirma va eng katta bonus olinadi', () => {
    const b = pickBenefit(
      [
        promo({ id: 'all', name: 'Hammaga', groupId: null, commissionDiscountPercent: 50, bonusPerOrder: 100 }),
        promo({ id: 'first', name: 'Birinchilar', groupId: 'g1', commissionDiscountPercent: 100, bonusPerOrder: 300 }),
      ],
      new Set(['g1']),
      NOW,
    );
    expect(b.discountPercent).toBe(100);
    expect(b.bonus).toBe(300);
    expect(b.bonusPromo?.id).toBe('first');
  });

  it('chegirma bir aksiyadan, bonus boshqasidan kelishi mumkin', () => {
    const b = pickBenefit(
      [
        promo({ id: 'disc', commissionDiscountPercent: 80, bonusPerOrder: 0 }),
        promo({ id: 'bon', commissionDiscountPercent: 0, bonusPerOrder: 500 }),
      ],
      new Set(),
      NOW,
    );
    expect([b.discountPercent, b.discountPromo?.id, b.bonus, b.bonusPromo?.id]).toEqual([80, 'disc', 500, 'bon']);
  });

  it('ishlamayotgan va tegmaydigan aksiyalar hisobga olinmaydi', () => {
    const b = pickBenefit(
      [
        promo({ active: false }),
        promo({ endsAt: new Date(NOW.getTime() - day) }),
        promo({ groupId: 'boshqa' }),
      ],
      new Set(['g1']),
      NOW,
    );
    expect(b).toEqual({ discountPercent: 0, bonus: 0, discountPromo: null, bonusPromo: null });
  });

  it('buzuq qiymatlar chegaralanadi (150 % -> 100, manfiy bonus -> 0)', () => {
    const b = pickBenefit([promo({ commissionDiscountPercent: 150, bonusPerOrder: -300 })], new Set(), NOW);
    expect(b.discountPercent).toBe(100);
    expect(b.bonus).toBe(0);
  });
});

describe('discounted — chegirmadan keyingi to‘lov', () => {
  it('100 % — umuman yechilmaydi, 0 % — o‘zgarmaydi', () => {
    expect(discounted(1000, 100)).toBe(0);
    expect(discounted(1000, 0)).toBe(1000);
  });

  it('yuvarlanadi va manfiy bo‘lmaydi', () => {
    expect(discounted(1001, 50)).toBe(501);
    expect(discounted(1000, 250)).toBe(0);
  });
});
