import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomerOrdersService } from './customer-orders.service';
import { CustomersController } from './customers.controller';
import { CustomerAppController } from './customer-app.controller';
import { Customer } from '../entities/customer.entity';
import { Order } from '../entities/order.entity';
import { DriversModule } from '../drivers/drivers.module';
import { OrdersModule } from '../orders/orders.module';
import { ReputationModule } from '../reputation/reputation.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Order]),
    DriversModule,
    OrdersModule,
    ReputationModule,
    TripsModule,
  ],
  controllers: [CustomersController, CustomerAppController],
  providers: [CustomersService, CustomerOrdersService],
  // `CustomerOrdersService` eksport qilinadi — Mini App ham SHU mantiqni
  // ishlatadi, o'ziga nusxa ko'chirmaydi.
  exports: [CustomersService, CustomerOrdersService],
})
export class CustomersModule {}
