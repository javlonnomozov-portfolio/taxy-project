import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BillingMode } from '@tty/shared';
import { Driver } from '../entities/driver.entity';
import { Transaction, TransactionType } from '../entities/transaction.entity';

const DEFAULT_PERCENT = 10;

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Transaction) private readonly txns: Repository<Transaction>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Billing rejimiga qarab safar komissiyasini hisoblash. */
  computeCommission(driver: Driver, fareTotal: number): number {
    const cfg = (driver.billingConfig ?? {}) as { percent?: number };
    switch (driver.billingMode) {
      case BillingMode.PERCENT:
      case BillingMode.HYBRID:
        return Math.round((fareTotal * (cfg.percent ?? DEFAULT_PERCENT)) / 100);
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
    const commission = this.computeCommission(driver, fareTotal);
    if (commission > 0) {
      const bal = await this.adjust(
        manager,
        driverId,
        -commission,
        'commission',
        orderId,
        'Safar komissiyasi',
      );
      this.log.log(`Komissiya ${commission} so'm yechildi — haydovchi ${driverId}, balans: ${bal}`);
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
