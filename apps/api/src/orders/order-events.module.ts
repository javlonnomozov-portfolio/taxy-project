import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEventsService } from './order-events.service';
import { OrderEvent } from '../entities/order-event.entity';

// Alohida modul — OrdersModule va DispatchModule umumiy ishlatadi (sikldan qochish).
@Module({
  imports: [TypeOrmModule.forFeature([OrderEvent])],
  providers: [OrderEventsService],
  exports: [OrderEventsService],
})
export class OrdersEventsModule {}
