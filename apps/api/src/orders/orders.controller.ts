import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TripsService } from '../trips/trips.service';
import { OrdersService } from './orders.service';
import { InternalGuard } from '../auth/internal.guard';
import { CancelOrderDto, CreateOrderDto } from './dto/order.dto';

// Buyurtmalar — bot backend nomidan chaqiradi (ichki kalit bilan).
@ApiTags('orders')
@ApiSecurity('internal')
@Controller('orders')
@UseGuards(InternalGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly trips: TripsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Buyurtma yaratish (dispatch avtomatik boshlanadi)' })
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buyurtma holati' })
  get(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Get(':id/driver-location')
  @ApiOperation({ summary: 'Biriktirilgan taksining oxirgi joylashuvi' })
  driverLocation(@Param('id') id: string) {
    return this.orders.driverLocation(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Mijoz buyurtmani bekor qiladi (jarimasiz oyna qoidasi)' })
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.trips.cancelByCustomer(id, dto.reason);
  }
}
