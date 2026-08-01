import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { DriversModule } from '../drivers/drivers.module';
import { OrdersModule } from '../orders/orders.module';
import { ReputationModule } from '../reputation/reputation.module';
import { TripsModule } from '../trips/trips.module';
import { MiniappController } from './miniapp.controller';
import { MiniappService } from './miniapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer]),
    DriversModule,
    OrdersModule,
    ReputationModule,
    // Bekor qilish qoidalari (jarima, dispatch to'xtatish) TripsService da.
    TripsModule,
  ],
  controllers: [MiniappController],
  providers: [MiniappService],
})
export class MiniappModule {}
