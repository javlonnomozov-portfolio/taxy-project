import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { TripTrack } from '../entities/trip-track.entity';
import { SosEvent } from '../entities/sos-event.entity';
import { OrdersEventsModule } from '../orders/order-events.module';
import { DriversModule } from '../drivers/drivers.module';
import { PricingModule } from '../pricing/pricing.module';
import { BillingModule } from '../billing/billing.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer, TripTrack, SosEvent]),
    OrdersEventsModule,
    DriversModule,
    PricingModule,
    BillingModule,
    // Mijoz bekor qilganda faol dispatch'ni to'xtatish uchun.
    // Sikl YO'Q: DispatchModule TripsModule'ni import qilmaydi.
    DispatchModule,
  ],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
