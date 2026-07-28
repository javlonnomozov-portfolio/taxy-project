import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { InternalGuard } from '../auth/internal.guard';
import { GeocodingService } from './geocoding.service';

class SearchQueryDto {
  @IsString() @MinLength(3) @MaxLength(120) q!: string;
}

class ReverseQueryDto {
  @Type(() => Number) @IsLatitude() lat!: number;
  @Type(() => Number) @IsLongitude() lng!: number;
}

class RouteQueryDto {
  @Type(() => Number) @IsLatitude() fromLat!: number;
  @Type(() => Number) @IsLongitude() fromLng!: number;
  @Type(() => Number) @IsLatitude() toLat!: number;
  @Type(() => Number) @IsLongitude() toLng!: number;
  @IsOptional() @IsString() category?: string;
}

/**
 * Geokodlash proksisi — bot va admin shu orqali manzil qidiradi.
 * Ichki kalit bilan himoyalangan: tashqi Nominatim/OSRM limitini ochiq
 * endpoint orqali sarflab yubormaslik uchun.
 */
@ApiTags('geo')
@ApiSecurity('internal')
@Controller('geo')
@UseGuards(InternalGuard)
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Geokodlash/marshrut xizmatlari sozlanganmi' })
  status() {
    return this.geocoding.status();
  }

  @Get('search')
  @ApiOperation({ summary: 'Manzil qidirish (avtoto‘ldirish)' })
  search(@Query() q: SearchQueryDto) {
    return this.geocoding.search(q.q);
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Koordinatadan manzil nomi' })
  reverse(@Query() q: ReverseQueryDto) {
    return this.geocoding.reverse(q.lat, q.lng);
  }

  @Get('route')
  @ApiOperation({ summary: 'Ikki nuqta orasidagi yo‘l masofasi va vaqti (taxminiy)' })
  route(@Query() q: RouteQueryDto) {
    return this.geocoding.route(
      { lat: q.fromLat, lng: q.fromLng },
      { lat: q.toLat, lng: q.toLng },
    );
  }
}
