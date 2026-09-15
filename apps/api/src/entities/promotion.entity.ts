import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../database/numeric.transformer';

/**
 * Aksiya: to'lovdan chegirma va/yoki har yakunlangan zakazga bonus.
 *
 * Qachon ishlaydi: `active` VA (boshlanish yo'q yoki o'tgan) VA (tugash yo'q
 * yoki hali kelmagan). Qoidaning o'zi `promotions/promotions.util.ts` da.
 */
@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Qo'lda yoqish/o'chirish. Sanalar bo'lsa ham o'chiq aksiya ishlamaydi. */
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'timestamptz', name: 'starts_at', nullable: true })
  startsAt!: Date | null;

  /** Shu vaqtdan boshlab aksiya O'ZI to'xtaydi. */
  @Column({ type: 'timestamptz', name: 'ends_at', nullable: true })
  endsAt!: Date | null;

  /** `null` — barcha haydovchilar. */
  @Column({ type: 'uuid', name: 'group_id', nullable: true })
  groupId!: string | null;

  /** Odatdagi to'lov/komissiyadan chegirma, 0..100. 100 — umuman yechilmaydi. */
  @Column({ type: 'int', name: 'commission_discount_percent', default: 0 })
  commissionDiscountPercent!: number;

  /** Har yakunlangan zakaz uchun balansga qo'shiladigan summa (so'm). */
  @Column({
    type: 'numeric',
    name: 'bonus_per_order',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  bonusPerOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
