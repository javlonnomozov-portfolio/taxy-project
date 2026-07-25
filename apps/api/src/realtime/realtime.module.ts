import { Module } from '@nestjs/common';
import { DriverGateway } from './driver.gateway';
import { CustomerGateway } from './customer.gateway';
import { OpsGateway } from './ops.gateway';
import { DriversModule } from '../drivers/drivers.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [DriversModule, DispatchModule, TripsModule],
  providers: [DriverGateway, CustomerGateway, OpsGateway],
})
export class RealtimeModule {}
