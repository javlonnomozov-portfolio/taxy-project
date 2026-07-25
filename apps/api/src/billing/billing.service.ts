import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  /** Balansdan/balansga o'zgartirish + transaksiya yozish. */
  private async adjust(
    driverId: string,
    delta: number,
    type: TransactionType,
    orderId?: string,
    note?: string,
  ): Promise<number> {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Haydovchi topilmadi');
    const balanceAfter = Number(driver.balance) + delta;
    await this.drivers.update(driverId, { balance: balanceAfter });
    await this.txns.save(
      this.txns.create({
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

  /** Safar yakunida komissiyani balansdan yechish (2.10). */
  async applyCommission(driverId: string, fareTotal: number, orderId: string): Promise<number> {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver) return 0;
    const commission = this.computeCommission(driver, fareTotal);
    if (commission > 0) {
      const bal = await this.adjust(driverId, -commission, 'commission', orderId, 'Safar komissiyasi');
      this.log.log(`Komissiya ${commission} so'm yechildi — haydovchi ${driverId}, balans: ${bal}`);
    }
    return commission;
  }

  /** Ofisda naqd to'ldirish (admin) (2.10). */
  topUp(driverId: string, amount: number, note?: string): Promise<number> {
    return this.adjust(driverId, Math.abs(amount), 'topup', undefined, note ?? 'Ofisda naqd to‘ldirish');
  }

  async getBalance(driverId: string): Promise<number> {
    const d = await this.drivers.findOne({ where: { id: driverId } });
    return d ? Number(d.balance) : 0;
  }

  listTransactions(driverId: string): Promise<Transaction[]> {
    return this.txns.find({ where: { driverId }, order: { createdAt: 'DESC' }, take: 100 });
  }
}
