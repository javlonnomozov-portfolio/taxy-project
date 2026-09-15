import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../database/numeric.transformer';

/**
 * `bonus` — aksiya bo'yicha har zakazga qo'shiladigan summa (2026-09-15).
 * Ustun `text` — yangi tur uchun migratsiya shart emas.
 */
export type TransactionType = 'commission' | 'topup' | 'subscription' | 'adjustment' | 'bonus';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'driver_id' })
  driverId!: string;

  @Column({ type: 'text' })
  type!: TransactionType;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  amount!: number;

  @Column({ type: 'numeric', name: 'balance_after', precision: 12, scale: 2, transformer: numericTransformer })
  balanceAfter!: number;

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
