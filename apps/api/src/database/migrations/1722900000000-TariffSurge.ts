import { MigrationInterface, QueryRunner } from 'typeorm';

// Surge (qimmatlashuv) TOIFA bo'yicha (2026-09-13).
//
// AVVAL: bitta global koeffitsient (`settings.config.surgeMultiplier`) uchala
// toifaga ham qo'llanardi. Yomg'irda Standart taksi taqchil bo'lsa,
// operator koeffitsientni oshirardi va Yuk mashinasi ham birga qimmatlashardi
// — holbuki yuk tashishga talab o'zgarmagan bo'lishi mumkin.
//
// ENDI: har tarif o'z koeffitsientiga ega, global `surgeActive` esa BOSH
// KALIT bo'lib qoladi (bitta tugma bilan hammasini o'chirish uchun).
//
// MAVJUD QIYMAT KO'CHIRILADI: yangi ustun hamma qatorga hozirgi global
// koeffitsient bilan to'ldiriladi, shunda deploy'dan keyin narx AYNAN
// avvalgidek qoladi. Sukut bo'yicha 1.00 qo'yib yuborilsa, surge yoqilgan
// bo'lsa narxlar jimgina tushib ketardi.
export class TariffSurge1722900000000 implements MigrationInterface {
  name = 'TariffSurge1722900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS surge_multiplier numeric(4,2) NOT NULL DEFAULT 1.00`,
    );

    // Hozirgi global qiymatni har toifaga ko'chiramiz (sozlamalar qatori
    // bo'lmasa yoki qiymat mantiqsiz bo'lsa — 1.00 qoladi).
    await q.query(`
      UPDATE tariffs
      SET surge_multiplier = sub.v
      FROM (
        SELECT LEAST(GREATEST(COALESCE((config->>'surgeMultiplier')::numeric, 1.00), 1.00), 3.00) AS v
        FROM settings WHERE id = 1
      ) AS sub
      WHERE sub.v IS NOT NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tariffs DROP COLUMN IF EXISTS surge_multiplier`);
  }
}
