import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Chatdagi ovozli xabar yoki rasmning BAYTLARI.
 *
 * `data` `select: false` — oddiy `find()` uni HECH QACHON tortmaydi. Baytlar
 * faqat fayl so'ralganda `addSelect` bilan o'qiladi (`ChatService.media`).
 */
@Entity('chat_media')
export class ChatMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Server baytlardan ANIQLAGAN tur — klient aytgani emas (`chat.media.ts`). */
  @Column({ type: 'text' })
  mime!: string;

  @Column({ type: 'int', name: 'size_bytes' })
  sizeBytes!: number;

  @Column({ type: 'bytea', select: false })
  data!: Buffer;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
