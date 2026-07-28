import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchService } from './dispatch.service';
import { DispatchOwnershipService } from './dispatch-ownership.service';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { Driver } from '../entities/driver.entity';
import { Tariff } from '../entities/tariff.entity';
import { OrdersEventsModule } from '../orders/order-events.module';
import { GeoModule } from '../geo/geo.module';
import { DriversModule } from '../drivers/drivers.module';
import { RealtimeCoreModule } from '../realtime/realtime-core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer, Driver, Tariff]),
    OrdersEventsModule,
    GeoModule,
    DriversModule,
    RealtimeCoreModule,
  ],
  providers: [DispatchService, DispatchOwnershipService],
  exports: [DispatchService],
})
export class DispatchModule {}
