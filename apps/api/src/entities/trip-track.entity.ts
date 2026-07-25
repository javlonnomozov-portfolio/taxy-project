import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface TrackPoint {
  lat: number;
  lng: number;
  at: string;
}

@Entity('trip_tracks')
export class TripTrack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @Column({ type: 'jsonb', default: [] })
  points!: TrackPoint[];

  @Column({ type: 'date', name: 'retention_until', nullable: true })
  retentionUntil!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
