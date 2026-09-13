import { MigrationInterface, QueryRunner } from 'typeorm';

// Haydovchi <-> panel chati: matn, ovozli xabar, rasm (2026-09-13).
//
// NEGA POSTGRES ICHIDA: foydalanuvchi qarori — yangi hisob ham, bog'liqlik ham
// kerak emas. Bir necha o'n haydovchi uchun yetarli; hajm cheklangan
// (rasm/ovoz <= 2 MB, server tomonda tekshiriladi).
//
// NEGA MEDIA ALOHIDA JADVALDA: xabarlar ro'yxati tez-tez o'qiladi (har ochilishda
// 50 ta). Baytlar shu jadvalda tursa, har ro'yxat megabaytlab ma'lumotni diskdan
// tortardi. Alohida jadvalda ular faqat fayl so'ralganda o'qiladi.
export class DriverChat1723100000000 implements MigrationInterface {
  name = 'DriverChat1723100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS chat_media (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mime text NOT NULL,
      size_bytes int NOT NULL,
      data bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS driver_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      sender text NOT NULL CHECK (sender IN ('driver', 'ops')),
      kind text NOT NULL CHECK (kind IN ('text', 'voice', 'image')),
      body text,
      media_id uuid REFERENCES chat_media(id),
      duration_sec int,
      author_id uuid,
      author_login text,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT driver_messages_payload CHECK (
        (kind = 'text' AND body IS NOT NULL) OR (kind <> 'text' AND media_id IS NOT NULL)
      )
    )`);

    // Suhbatni ochish: bitta haydovchining so'nggi xabarlari.
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_driver_messages_driver_time ON driver_messages (driver_id, created_at DESC)`,
    );
    // O'qilmaganlar soni (panel ro'yxati har yangilanishda so'raydi).
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_driver_messages_unread ON driver_messages (driver_id, sender) WHERE read_at IS NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS driver_messages`);
    await q.query(`DROP TABLE IF EXISTS chat_media`);
  }
}
