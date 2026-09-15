/**
 * Aksiya qoidalari — SOF mantiq (DB'siz), shuning uchun to'g'ridan test qilinadi.
 * Pul bilan bog'liq: bu yerdagi har o'zgarish testda aks etishi shart.
 */

export interface PromoRule {
  id: string;
  name: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  /** `null` — barcha haydovchilar. */
  groupId: string | null;
  commissionDiscountPercent: number;
  bonusPerOrder: number;
}

export type PromoState = 'live' | 'scheduled' | 'ended' | 'off';

/** Panelda ko'rsatiladigan holat. */
export function promoState(p: PromoRule, now: Date = new Date()): PromoState {
  if (!p.active) return 'off';
  if (p.startsAt && now < p.startsAt) return 'scheduled';
  // Tugash vaqti O'ZI ham kirmaydi: "31-dekabr 23:59:59 gacha" = ends_at 1-yanvar 00:00.
  if (p.endsAt && now >= p.endsAt) return 'ended';
  return 'live';
}

export const isLive = (p: PromoRule, now: Date = new Date()): boolean => promoState(p, now) === 'live';

/** Aksiya shu haydovchiga tegadimi (barchaga yoki uning guruhlaridan biriga). */
export function appliesTo(p: PromoRule, driverGroupIds: ReadonlySet<string>): boolean {
  return p.groupId === null || driverGroupIds.has(p.groupId);
}

export interface Benefit {
  discountPercent: number;
  bonus: number;
  discountPromo: { id: string; name: string } | null;
  bonusPromo: { id: string; name: string } | null;
}

const clampPercent = (v: number) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));

/**
 * Haydovchiga hozir tegadigan imtiyoz.
 *
 * Bir nechta aksiya bir vaqtda to'g'ri kelsa, ular QO'SHILMAYDI: eng katta
 * chegirma va eng katta bonus alohida tanlanadi. Qo'shilsa, "barchaga +100"
 * va "birinchilarga +300" birga yoqilganda tasodifan +400 berilib ketardi.
 */
export function pickBenefit(
  promos: PromoRule[],
  driverGroupIds: ReadonlySet<string>,
  now: Date = new Date(),
): Benefit {
  const out: Benefit = { discountPercent: 0, bonus: 0, discountPromo: null, bonusPromo: null };
  for (const p of promos) {
    if (!isLive(p, now) || !appliesTo(p, driverGroupIds)) continue;
    const pct = clampPercent(p.commissionDiscountPercent);
    if (pct > out.discountPercent) {
      out.discountPercent = pct;
      out.discountPromo = { id: p.id, name: p.name };
    }
    const bonus = Math.max(0, Math.round(Number(p.bonusPerOrder) || 0));
    if (bonus > out.bonus) {
      out.bonus = bonus;
      out.bonusPromo = { id: p.id, name: p.name };
    }
  }
  return out;
}

/** Chegirmadan keyingi to'lov — butun so'mga yuvarlanadi, manfiy bo'lmaydi. */
export function discounted(commission: number, percent: number): number {
  const pct = clampPercent(percent);
  return Math.max(0, Math.round((Number(commission) * (100 - pct)) / 100));
}
