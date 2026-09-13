import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Kim yozdi: haydovchi yoki panel (operator/admin — `authorLogin` da). */
export type ChatSender = 'driver' | 'ops';
export type ChatKind = 'text' | 'voice' | 'image';

/**
 * Haydovchi <-> panel chati. Har haydovchi bilan BITTA suhbat; panel tomonida
 * istalgan navbatchi javob beradi va xabarda kim yozgani saqlanadi.
 */
@Entity('driver_messages')
export class DriverMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'driver_id' })
  driverId!: string;

  @Column({ type: 'text' })
  sender!: ChatSender;

  @Column({ type: 'text' })
  kind!: ChatKind;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'uuid', name: 'media_id', nullable: true })
  mediaId!: string | null;

  /** Ovozli xabar uzunligi (soniya) — pleyer yuklanmasdan ko'rsatish uchun. */
  @Column({ type: 'int', name: 'duration_sec', nullable: true })
  durationSec!: number | null;

  /** Panel xabarida: yozgan akkaunt. Haydovchi xabarida bo'sh. */
  @Column({ type: 'uuid', name: 'author_id', nullable: true })
  authorId!: string | null;

  @Column({ type: 'text', name: 'author_login', nullable: true })
  authorLogin!: string | null;

  /** QARSHI tomon o'qigan vaqt (haydovchi xabarini panel, va aksincha). */
  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
