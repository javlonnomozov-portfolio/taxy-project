import { MigrationInterface, QueryRunner } from 'typeorm';

// Operator buyurtma narxini tuzata olishi (2026-09-13).
//
// NEGA: hayotda kelishuv taksometrdan chetga chiqadi. Mijozda katta yuk bor,
// mijoz yo'lda kutib turishni so'radi, mashina kirmaydigan ko'chaga borish
// kerak — bularning hammasi haydovchi va operator o'rtasida telefon orqali
// hal bo'lardi va TIZIMDAN TASHQARIDA pul olinardi. Ya'ni hisobotda ham,
// komissiyada ham u pul ko'rinmasdi.
//
// NEGA TOIFANI O'ZGARTIRISH EMAS: birinchi fikr "zakazni Comfort'ga
// o'tkazish" edi, lekin u butun hisobni (baza + km narxi + kutish) qayta
// yozadi va safar o'rtasida taksometr sakrab ketadi. Qo'shimcha esa ALOHIDA
// qator bo'lib turadi: mijoz nima uchun to'layotganini ko'radi.
//
// SABAB MAJBURIY (`reason`): summa sababsiz o'zgarsa, bu mijoz uchun ham,
// keyinchalik nizo chiqqanda operator uchun ham tushunarsiz bo'lardi.
export class OrderFareAdjustment1723000000000 implements MigrationInterface {
  name = 'OrderFareAdjustment1723000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fare_adjustment numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await q.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fare_adjustment_reason text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders DROP COLUMN IF EXISTS fare_adjustment_reason`);
    await q.query(`ALTER TABLE orders DROP COLUMN IF EXISTS fare_adjustment`);
  }
}
