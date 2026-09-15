import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { DriverGroup, DriverGroupMember } from '../entities/driver-group.entity';
import { Promotion } from '../entities/promotion.entity';
import { Driver } from '../entities/driver.entity';
import { Benefit, PromoRule, pickBenefit, promoState } from './promotions.util';

export interface PromotionInput {
  name?: string;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  groupId?: string | null;
  commissionDiscountPercent?: number;
  bonusPerOrder?: number;
}

const NO_BENEFIT: Benefit = { discountPercent: 0, bonus: 0, discountPromo: null, bonusPromo: null };

const isUniqueViolation = (e: unknown) =>
  e instanceof QueryFailedError &&
  (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

const toRule = (p: Promotion): PromoRule => ({
  id: p.id,
  name: p.name,
  active: p.active,
  startsAt: p.startsAt ? new Date(p.startsAt) : null,
  endsAt: p.endsAt ? new Date(p.endsAt) : null,
  groupId: p.groupId,
  commissionDiscountPercent: Number(p.commissionDiscountPercent) || 0,
  bonusPerOrder: Number(p.bonusPerOrder) || 0,
});

/**
 * Haydovchi guruhlari va aksiyalar.
 *
 * Qoidaning o'zi (qachon ishlaydi, kimga tegadi, bir nechtasi bo'lsa qaysi)
 * `promotions.util.ts` da — bu servis faqat saqlaydi va o'qiydi.
 */
@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(DriverGroup) private readonly groups: Repository<DriverGroup>,
    @InjectRepository(DriverGroupMember) private readonly members: Repository<DriverGroupMember>,
    @InjectRepository(Promotion) private readonly promos: Repository<Promotion>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
  ) {}

  // ---------------------------------------------------------------- guruhlar

  async listGroups() {
    const [rows, counts] = await Promise.all([
      this.groups.find({ order: { name: 'ASC' } }),
      this.members.query(
        `SELECT group_id, count(*)::int AS n FROM driver_group_members GROUP BY group_id`,
      ) as Promise<Array<{ group_id: string; n: number }>>,
    ]);
    const byId = new Map(counts.map((c) => [c.group_id, c.n]));
    return rows.map((g) => ({ id: g.id, name: g.name, createdAt: g.createdAt, memberCount: byId.get(g.id) ?? 0 }));
  }

  async createGroup(name: string) {
    try {
      return await this.groups.save(this.groups.create({ name: name.trim() }));
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Bu nomli guruh allaqachon bor');
      throw e;
    }
  }

  async renameGroup(id: string, name: string) {
    const g = await this.mustGroup(id);
    g.name = name.trim();
    try {
      return await this.groups.save(g);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Bu nomli guruh allaqachon bor');
      throw e;
    }
  }

  /** Aksiyada ishlatilayotgan guruh o'chirilmaydi — aks holda aksiya ham jimgina yo'qolardi. */
  async deleteGroup(id: string) {
    await this.mustGroup(id);
    const used = await this.promos.count({ where: { groupId: id } });
    if (used > 0) {
      throw new ConflictException('Guruh aksiyada ishlatilmoqda — avval aksiyani o‘chiring yoki boshqa guruhga o‘tkazing');
    }
    await this.groups.delete(id);
    return { ok: true };
  }

  async groupMembers(id: string) {
    await this.mustGroup(id);
    const rows = await this.members.find({ where: { groupId: id } });
    if (rows.length === 0) return [];
    const list = await this.drivers.find({ where: { id: In(rows.map((r) => r.driverId)) } });
    return list
      .map((d) => ({ id: d.id, firstName: d.firstName, lastName: d.lastName, phone: d.phone }))
      .sort((a, b) => (a.firstName ?? '').localeCompare(b.firstName ?? ''));
  }

  /** Takror qo'shish xato emas — tugma ikki marta bosilishi mumkin. */
  async addMember(groupId: string, driverId: string) {
    await this.mustGroup(groupId);
    if (!(await this.drivers.exist({ where: { id: driverId } }))) {
      throw new NotFoundException('Haydovchi topilmadi');
    }
    await this.members
      .createQueryBuilder()
      .insert()
      .into(DriverGroupMember)
      .values({ groupId, driverId })
      .orIgnore()
      .execute();
    return { ok: true };
  }

  async removeMember(groupId: string, driverId: string) {
    await this.members.delete({ groupId, driverId });
    return { ok: true };
  }

  async driverGroups(driverId: string) {
    const rows = await this.members.find({ where: { driverId } });
    if (rows.length === 0) return [];
    const list = await this.groups.find({ where: { id: In(rows.map((r) => r.groupId)) }, order: { name: 'ASC' } });
    return list.map((g) => ({ id: g.id, name: g.name }));
  }

  // --------------------------------------------------------------- aksiyalar

  async listPromotions(now: Date = new Date()) {
    const [rows, groups] = await Promise.all([
      this.promos.find({ order: { createdAt: 'DESC' } }),
      this.groups.find(),
    ]);
    const names = new Map(groups.map((g) => [g.id, g.name]));
    return rows.map((p) => ({
      ...p,
      groupName: p.groupId ? (names.get(p.groupId) ?? null) : null,
      state: promoState(toRule(p), now),
    }));
  }

  async createPromotion(input: PromotionInput) {
    const p = this.promos.create({});
    await this.apply(p, input, true);
    return this.promos.save(p);
  }

  async updatePromotion(id: string, input: PromotionInput) {
    const p = await this.promos.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Aksiya topilmadi');
    await this.apply(p, input, false);
    return this.promos.save(p);
  }

  async deletePromotion(id: string) {
    const res = await this.promos.delete(id);
    if (!res.affected) throw new NotFoundException('Aksiya topilmadi');
    return { ok: true };
  }

  /**
   * Haydovchiga hozir tegadigan imtiyoz. Safar yakunlanadigan TRANZAKSIYA ichida
   * (`manager`) o'qiladi — to'lov va bonus bir xil ma'lumotga tayanadi.
   */
  async benefitFor(manager: EntityManager, driverId: string, now: Date = new Date()): Promise<Benefit> {
    const list = await manager.find(Promotion, { where: { active: true } });
    if (list.length === 0) return NO_BENEFIT;
    const rows = await manager.find(DriverGroupMember, { where: { driverId } });
    return pickBenefit(list.map(toRule), new Set(rows.map((r) => r.groupId)), now);
  }

  // -------------------------------------------------------------------- ichki

  private async apply(p: Promotion, i: PromotionInput, creating: boolean): Promise<void> {
    if (i.name !== undefined) p.name = i.name.trim();
    if (i.active !== undefined) p.active = i.active;
    if (i.startsAt !== undefined) p.startsAt = i.startsAt ? new Date(i.startsAt) : null;
    if (i.endsAt !== undefined) p.endsAt = i.endsAt ? new Date(i.endsAt) : null;
    if (i.groupId !== undefined) {
      if (i.groupId) await this.mustGroup(i.groupId);
      p.groupId = i.groupId ?? null;
    }
    if (i.commissionDiscountPercent !== undefined) p.commissionDiscountPercent = i.commissionDiscountPercent;
    if (i.bonusPerOrder !== undefined) p.bonusPerOrder = i.bonusPerOrder;

    if (creating) {
      if (p.active === undefined) p.active = true;
      if (p.startsAt === undefined) p.startsAt = null;
      if (p.endsAt === undefined) p.endsAt = null;
      if (p.groupId === undefined) p.groupId = null;
      if (p.commissionDiscountPercent === undefined) p.commissionDiscountPercent = 0;
      if (p.bonusPerOrder === undefined) p.bonusPerOrder = 0;
    }

    if (!p.name) throw new BadRequestException('Aksiya nomi kerak');
    if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt) {
      throw new BadRequestException('Tugash vaqti boshlanishdan keyin bo‘lishi kerak');
    }
    // Bo'sh aksiya hech narsa qilmaydi, lekin ro'yxatda "ishlayapti" deb turardi.
    if (!Number(p.commissionDiscountPercent) && !Number(p.bonusPerOrder)) {
      throw new BadRequestException('Chegirma yoki bonusdan kamida biri kerak');
    }
  }

  private async mustGroup(id: string): Promise<DriverGroup> {
    const g = await this.groups.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Guruh topilmadi');
    return g;
  }
}
