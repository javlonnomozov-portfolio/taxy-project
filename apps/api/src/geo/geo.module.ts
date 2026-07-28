import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeocodingService } from './geocoding.service';
import { GeocodingController } from './geocoding.controller';

@Module({
  controllers: [GeocodingController],
  providers: [GeoService, GeocodingService],
  exports: [GeoService, GeocodingService],
})
export class GeoModule {}
