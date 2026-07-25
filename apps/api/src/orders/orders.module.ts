import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { OrdersEventsModule } from './order-events.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer]),
    OrdersEventsModule,
    DispatchModule,
    TripsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
