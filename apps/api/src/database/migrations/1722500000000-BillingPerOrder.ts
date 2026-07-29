import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Yangi billing rejimi: `per_order` — har yakunlangan zakaz uchun QAT'IY summa
 * (safar narxiga bog'liq emas). Summa admin panelidan sozlanadi
 * (`settings.config.perOrderFee`), haydovchi darajasida `billingConfig.perOrder`
 * bilan ustidan yozish mumkin.
 *
 * `billing_mode` Postgres ENUM turi — yangi qiymatni ALTER TYPE bilan qo'shamiz,
 * aks holda `PUT /ops/drivers/:id/billing` 500 beradi.
 */
export class BillingPerOrder1722500000000 implements MigrationInterface {
  name = 'BillingPerOrder1722500000000';

  public async up(q: QueryRunner): Promise<void> {
    // IF NOT EXISTS — migratsiya qayta ishga tushsa yiqilmasin.
    await q.query(`ALTER TYPE billing_mode ADD VALUE IF NOT EXISTS 'per_order'`);

    // Mavjud sozlamalar qatoriga default summani qo'shamiz (agar hali yo'q bo'lsa).
    // Yangi o'rnatishlarda `SettingsService.DEFAULTS` shu qiymatni beradi.
    await q.query(`
      UPDATE settings
      SET config = config || '{"perOrderFee": 1000}'::jsonb
      WHERE id = 1 AND NOT (config ? 'perOrderFee')
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Postgres ENUM'dan qiymatni O'CHIRIB BO'LMAYDI (ALTER TYPE ... DROP VALUE yo'q).
    // Shuning uchun faqat bu rejimdagi haydovchilarni xavfsiz holatga qaytaramiz.
    await q.query(`UPDATE drivers SET billing_mode = 'subscription' WHERE billing_mode = 'per_order'`);
    await q.query(`UPDATE settings SET config = config - 'perOrderFee' WHERE id = 1`);
  }
}
