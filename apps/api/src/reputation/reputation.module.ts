import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReputationService } from './reputation.service';
import { ReputationController } from './reputation.controller';
import { Rating } from '../entities/rating.entity';
import { Order } from '../entities/order.entity';
import { Driver } from '../entities/driver.entity';
import { Customer } from '../entities/customer.entity';
import { OrderEvent } from '../entities/order-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Order, Driver, Customer, OrderEvent])],
  controllers: [ReputationController],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
