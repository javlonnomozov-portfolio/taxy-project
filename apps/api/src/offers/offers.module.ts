import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [DispatchModule],
  controllers: [OffersController],
})
export class OffersModule {}
