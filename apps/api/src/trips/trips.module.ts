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

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer, TripTrack, SosEvent]),
    OrdersEventsModule,
    DriversModule,
    PricingModule,
    BillingModule,
  ],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
