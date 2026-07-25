import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { Driver } from '../entities/driver.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Transaction])],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
