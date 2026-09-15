import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/** Haydovchilar guruhi — aksiya yoki chegirmani bir guruhga qo'llash uchun. */
@Entity('driver_groups')
export class DriverGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/** Guruh a'zoligi. Bitta haydovchi bir nechta guruhda bo'lishi mumkin. */
@Entity('driver_group_members')
export class DriverGroupMember {
  @PrimaryColumn({ type: 'uuid', name: 'group_id' })
  groupId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'driver_id' })
  driverId!: string;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt!: Date;
}
