import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export interface SettingsConfig {
  surgeMultiplier: number;
  surgeActive: boolean;
  freeCancelSec: number;
}

@Entity('settings')
export class Settings {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'jsonb' })
  config!: SettingsConfig;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
