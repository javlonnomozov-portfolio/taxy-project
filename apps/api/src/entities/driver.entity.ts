import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalStatus, BillingMode, DriverStatus } from '@tty/shared';
import { Vehicle } from './vehicle.entity';

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  phone!: string;

  @Column({ type: 'text', name: 'first_name', nullable: true })
  firstName!: string | null;

  @Column({ type: 'text', name: 'last_name', nullable: true })
  lastName!: string | null;

  @Column({ type: 'text', name: 'password_hash', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'boolean', name: 'must_change_password', default: true })
  mustChangePassword!: boolean;

  @Column({ type: 'text', name: 'push_token', nullable: true })
  pushToken!: string | null;

  @Column({ type: 'enum', enum: DriverStatus, enumName: 'driver_status', default: DriverStatus.OFFLINE })
  status!: DriverStatus;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    enumName: 'approval_status',
    name: 'approval_status',
    default: ApprovalStatus.PENDING,
  })
  approvalStatus!: ApprovalStatus;

  @Column({
    type: 'enum',
    enum: BillingMode,
    enumName: 'billing_mode',
    name: 'billing_mode',
    default: BillingMode.SUBSCRIPTION,
  })
  billingMode!: BillingMode;

  @Column({ type: 'jsonb', name: 'billing_config', default: {} })
  billingConfig!: Record<string, unknown>;

  @Column({ type: 'numeric', name: 'rating_avg', precision: 3, scale: 2, default: 0 })
  ratingAvg!: number;

  @Column({ type: 'numeric', name: 'cancel_rate', precision: 5, scale: 2, default: 0 })
  cancelRate!: number;

  @Column({ type: 'numeric', name: 'acceptance_rate', precision: 5, scale: 2, default: 0 })
  acceptanceRate!: number;

  @Column({ type: 'numeric', name: 'completion_rate', precision: 5, scale: 2, default: 0 })
  completionRate!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  balance!: number;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt!: Date | null;

  // Oxirgi ma'lum joylashuv — onlayn ham, safar (ON_TRIP) davomida ham yangilanadi.
  // Xarita va mijozga "taksi qayerda" ni ko'rsatish uchun yagona manba.
  @Column({ type: 'double precision', name: 'last_lat', nullable: true })
  lastLat!: number | null;

  @Column({ type: 'double precision', name: 'last_lng', nullable: true })
  lastLng!: number | null;

  @Column({ type: 'timestamptz', name: 'last_location_at', nullable: true })
  lastLocationAt!: Date | null;

  @OneToMany(() => Vehicle, (v) => v.driver)
  vehicles!: Vehicle[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
