import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RatingDirection = 'customer_to_driver' | 'driver_to_customer';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @Column({ type: 'text' })
  direction!: RatingDirection;

  @Index()
  @Column({ type: 'uuid', name: 'driver_id', nullable: true })
  driverId!: string | null;

  @Index()
  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  scores!: Record<string, number>;

  @Column({ type: 'numeric', precision: 3, scale: 2 })
  overall!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
