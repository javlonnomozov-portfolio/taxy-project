import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../database/numeric.transformer';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', name: 'telegram_id', nullable: true, unique: true })
  telegramId!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', name: 'first_name', nullable: true })
  firstName!: string | null;

  @Column({ type: 'text', name: 'last_name', nullable: true })
  lastName!: string | null;

  @Column({ type: 'boolean', name: 'show_name', default: false })
  showName!: boolean;

  @Column({ type: 'text', default: 'uz' })
  language!: string;

  @Column({ type: 'boolean', name: 'is_blocked', default: false })
  isBlocked!: boolean;

  @Column({ type: 'numeric', name: 'rating_avg', precision: 3, scale: 2, default: 0, transformer: numericTransformer })
  ratingAvg!: number;

  @Column({ type: 'numeric', name: 'cancel_rate', precision: 5, scale: 2, default: 0, transformer: numericTransformer })
  cancelRate!: number;

  @Column({ type: 'int', name: 'no_show_count', default: 0 })
  noShowCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
