import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { DriversModule } from '../drivers/drivers.module';
import { OrdersModule } from '../orders/orders.module';
import { ReputationModule } from '../reputation/reputation.module';
import { MiniappController } from './miniapp.controller';
import { MiniappService } from './miniapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer]),
    DriversModule,
    OrdersModule,
    ReputationModule,
  ],
  controllers: [MiniappController],
  providers: [MiniappService],
})
export class MiniappModule {}
