import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpsService } from './ops.service';
import { OpsController } from './ops.controller';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { OrdersEventsModule } from '../orders/order-events.module';
import { DriversModule } from '../drivers/drivers.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer]),
    OrdersEventsModule,
    DriversModule,
    DispatchModule,
    BillingModule,
  ],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
