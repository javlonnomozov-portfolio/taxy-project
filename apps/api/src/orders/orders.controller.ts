import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TripsService } from '../trips/trips.service';
import {
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, VehicleCategory } from '@tty/shared';
import { OrdersService } from './orders.service';
import { InternalGuard } from '../auth/internal.guard';

class PointDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}
class CreateOrderDto {
  @IsString() customerId!: string;
  @IsEnum(VehicleCategory) category!: VehicleCategory;
  @ValidateNested() @Type(() => PointDto) pickup!: PointDto;
  @IsOptional() @IsString() pickupAddress?: string;
  @IsOptional() @ValidateNested() @Type(() => PointDto) destination?: PointDto;
  @IsOptional() @IsString() destAddress?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsEnum(OrderType) orderType?: OrderType;
  @IsOptional() @IsISO8601() scheduledAt?: string;
}

// Buyurtma yaratish — bot backend orqali (ichki kalit bilan).
class CancelDto {
  @IsOptional() @IsString() reason?: string;
}

@Controller('orders')
@UseGuards(InternalGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly trips: TripsService,
  ) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelDto) {
    return this.trips.cancelByCustomer(id, dto.reason);
  }
}
