import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderStatus, OrderType, VehicleCategory } from '@tty/shared';

// GeoJSON Point ({ type:'Point', coordinates:[lng,lat] }) — PostGIS geography bilan.
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId!: string;

  @Column({ type: 'uuid', name: 'driver_id', nullable: true })
  driverId!: string | null;

  @Column({ type: 'enum', enum: OrderType, enumName: 'order_type', name: 'order_type', default: OrderType.STANDARD })
  orderType!: OrderType;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status', default: OrderStatus.CREATED })
  status!: OrderStatus;

  @Column({
    type: 'enum',
    enum: VehicleCategory,
    enumName: 'vehicle_category',
    name: 'vehicle_category',
    default: VehicleCategory.STANDARD,
  })
  vehicleCategory!: VehicleCategory;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'pickup_point',
  })
  pickupPoint!: GeoPoint;

  @Column({ type: 'text', name: 'pickup_address', nullable: true })
  pickupAddress!: string | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'dest_point',
    nullable: true,
  })
  destPoint!: GeoPoint | null;

  @Column({ type: 'text', name: 'dest_address', nullable: true })
  destAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'timestamptz', name: 'scheduled_at', nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: 'numeric', name: 'estimated_price', precision: 10, scale: 2, nullable: true })
  estimatedPrice!: number | null;

  @Column({ type: 'numeric', name: 'final_price', precision: 10, scale: 2, nullable: true })
  finalPrice!: number | null;

  @Column({ type: 'int', name: 'distance_m', nullable: true })
  distanceM!: number | null;

  @Column({ type: 'int', name: 'waiting_minutes', default: 0 })
  waitingMinutes!: number;

  @Column({ type: 'numeric', name: 'surge_multiplier', precision: 4, scale: 2, default: 1.0 })
  surgeMultiplier!: number;

  @Column({ type: 'numeric', name: 'night_multiplier', precision: 4, scale: 2, default: 1.0 })
  nightMultiplier!: number;

  @Column({ type: 'numeric', name: 'commission_amount', precision: 10, scale: 2, nullable: true })
  commissionAmount!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;
}
