import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BillingMode } from '@tty/shared';
import { Driver } from '../entities/driver.entity';
import { Transaction, TransactionType } from '../entities/transaction.entity';
import { SettingsService } from '../settings/settings.service';
import { PromotionsService } from '../promotions/promotions.service';
import { discounted } from '../promotions/promotions.util';

const DEFAULT_PERCENT = 10;

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Transaction) private readonly txns: Repository<Transaction>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly promotions: PromotionsService,
  ) {}

  /**
   * Billing rejimiga qarab safar komissiyasini hisoblash.
   *
   * `perOrderFee` — `per_order` rejimi uchun tizim sozlamasidan kelgan qat'iy
   * summa. Haydovchi darajasidagi `billingConfig.perOrder` undan ustun turadi
   * (ayrim haydovchi bilan boshqacha kelishuv bo'lishi mumkin).
   *
   * Sof funksiya — repozitoriysiz test qilinadi.
   */
  computeCommission(driver: Driver, fareTotal: number, perOrderFee = 0): number {
    const cfg = (driver.billingConfig ?? {}) as { percent?: number; perOrder?: number };
    switch (driver.billingMode) {
      case BillingMode.PERCENT:
      case BillingMode.HYBRID:
        return Math.round((fareTotal * (cfg.percent ?? DEFAULT_PERCENT)) / 100);
      case BillingMode.PER_ORDER: {
        const fee = cfg.perOrder ?? perOrderFee;
        return Math.max(0, Math.round(Number(fee) || 0));
      }
      case BillingMode.SUBSCRIPTION:
      default:
        return 0; // obuna — per-safar komissiya yo'q
    }
  }

  /**
   * Balansni ATOMIK o'zgartirish + transaksiya yozish.
   * `balance = balance + delta` bitta SQL bilan bajariladi — o'qib-hisoblab-yozish
   * (read-modify-write) parallel operatsiyalarda yangilanishni yo'qotardi.
   * Chaqiruvchi `manager` beradi, shunda balans va transaksiya yozuvi bitta
   * tranzaksiyada bo'ladi (masalan safarni yakunlash bilan birga).
   */
  private async adjust(
    manager: EntityManager,
    driverId: string,
    delta: number,
    type: TransactionType,
    orderId?: string,
    note?: string,
  ): Promise<number> {
    // DIQQAT: TypeORM `query()` UPDATE uchun `[rows, affectedCount]` qaytaradi
    // (SELECT'da esa to'g'ridan `rows`). Destrukturizatsiyasiz `rows[0].balance`
    // undefined bo'lib, balans NaN bo'lib yozilardi.
    const [rows]: [Array<{ balance: string }>, number] = await manager.query(
      `UPDATE drivers SET balance = balance + $2 WHERE id = $1 RETURNING balance`,
      [driverId, delta],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Haydovchi topilmadi');
    const balanceAfter = Number(rows[0].balance);
    if (!Number.isFinite(balanceAfter)) {
      throw new Error(`Balansni hisoblab bo'lmadi (haydovchi ${driverId})`);
    }

    await manager.save(
      Transaction,
      manager.create(Transaction, {
        driverId,
        type,
        amount: delta,
        balanceAfter,
        orderId: orderId ?? null,
        note: note ?? null,
      }),
    );
    return balanceAfter;
  }

  /**
   * Safar yakunida komissiyani balansdan yechish (2.10).
   * `manager` — chaqiruvchining tranzaksiyasi (safarni yakunlash bilan atomik bo'lishi shart).
   */
  async applyCommission(
    manager: EntityManager,
    driverId: string,
    fareTotal: number,
    orderId: string,
  ): Promise<number> {
    const driver = await manager.findOne(Driver, { where: { id: driverId } });
    if (!driver) return 0;
    const { perOrderFee } = await this.settings.getConfig();
    const base = this.computeCommission(driver, fareTotal, perOrderFee);

    // Aksiya: to'lovdan chegirma va/yoki har zakazga bonus. Shu tranzaksiya
    // ichida o'qiladi — to'lov yechilishi va bonus bir xil holatga tayanadi.
    // (Avval `per_order = -300` bilan "bonus" berib bo'lmasdi: `computeCommission`
    // manfiyni 0 ga aylantiradi va haydovchi shunchaki tekin ishlardi.)
    const benefit = await this.promotions.benefitFor(manager, driverId);
    const commission = discounted(base, benefit.discountPercent);
    if (benefit.discountPromo && commission < base) {
      this.log.log(
        `Aksiya chegirmasi ${benefit.discountPercent}% (${benefit.discountPromo.name}): ${base} -> ${commission} — haydovchi ${driverId}`,
      );
    }

    if (commission > 0) {
      // DIQQAT: balans MANFIYGA o'tishi mumkin — ataylab shunday. Haydovchi
      // qarzda qolsa ham safar yakunlanadi va pul yoziladi; qarzni ofisda
      // to'ldiradi. Aks holda yakunlash bloklanib, mijoz ham, haydovchi ham
      // hech nima qila olmay qolardi.
      const bal = await this.adjust(
        manager,
        driverId,
        -commission,
        'commission',
        orderId,
        driver.billingMode === BillingMode.PER_ORDER ? 'Zakaz uchun to‘lov' : 'Safar komissiyasi',
      );
      this.log.log(`Komissiya ${commission} so'm yechildi — haydovchi ${driverId}, balans: ${bal}`);
    }

    if (benefit.bonus > 0 && benefit.bonusPromo) {
      const bal = await this.adjust(
        manager,
        driverId,
        benefit.bonus,
        'bonus',
        orderId,
        `Aksiya: ${benefit.bonusPromo.name}`,
      );
      this.log.log(`Aksiya bonusi +${benefit.bonus} so'm — haydovchi ${driverId}, balans: ${bal}`);
    }
    return commission;
  }

  /** Ofisda naqd to'ldirish (admin) (2.10) — o'z tranzaksiyasida. */
  topUp(driverId: string, amount: number, note?: string): Promise<number> {
    return this.dataSource.transaction((manager) =>
      this.adjust(
        manager,
        driverId,
        Math.abs(amount),
        'topup',
        undefined,
        note ?? 'Ofisda naqd to‘ldirish',
      ),
    );
  }

  async getBalance(driverId: string): Promise<number> {
    const d = await this.drivers.findOne({ where: { id: driverId } });
    return d ? d.balance : 0;
  }

  listTransactions(driverId: string): Promise<Transaction[]> {
    return this.txns.find({ where: { driverId }, order: { createdAt: 'DESC' }, take: 100 });
  }
}
