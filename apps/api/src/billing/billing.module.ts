import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { Driver } from '../entities/driver.entity';
import { Transaction } from '../entities/transaction.entity';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Transaction]), PromotionsModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
