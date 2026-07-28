import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { VehicleCategory } from '@tty/shared';
import { numericTransformer } from '../database/numeric.transformer';

@Entity('tariffs')
export class Tariff {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: VehicleCategory, enumName: 'vehicle_category', unique: true })
  category!: VehicleCategory;

  @Column({ type: 'numeric', name: 'base_fare', precision: 10, scale: 2, transformer: numericTransformer })
  baseFare!: number;

  @Column({ type: 'numeric', name: 'per_km', precision: 10, scale: 2, transformer: numericTransformer })
  perKm!: number;

  @Column({ type: 'numeric', name: 'waiting_per_min', precision: 10, scale: 2, transformer: numericTransformer })
  waitingPerMin!: number;

  @Column({ type: 'int', name: 'free_wait_min' })
  freeWaitMin!: number;

  @Column({ type: 'time', name: 'night_from' })
  nightFrom!: string;

  @Column({ type: 'time', name: 'night_to' })
  nightTo!: string;

  @Column({ type: 'numeric', name: 'night_multiplier', precision: 4, scale: 2, transformer: numericTransformer })
  nightMultiplier!: number;
}
