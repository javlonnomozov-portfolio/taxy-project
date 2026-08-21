import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsEnum, IsInt, IsLatitude, IsLongitude, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleCategory } from '@tty/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Roles } from '../auth/roles';
import { CustomerOrdersService } from './customer-orders.service';

class PointDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

class CreateOrderDto {
  @IsEnum(VehicleCategory) category!: VehicleCategory;
  @ValidateNested() @Type(() => PointDto) pickup!: PointDto;
}

class RateDto {
  @IsInt() @Min(1) @Max(5) score!: number;
}

/**
 * Mijoz ILOVASI uchun endpointlar — JWT bilan (`role: 'customer'`).
 *
 * Mini App'dagi `/miniapp/*` bilan bir xil ishni qiladi, lekin boshqa
 * autentifikatsiya bilan. MANTIQ TAKRORLANMAYDI: ikkalasi ham
 * `CustomerOrdersService` ni chaqiradi (qarang: shu servis izohi).
 */
@ApiTags('customer-app')
@ApiBearerAuth('jwt')
@Controller('customer')
@UseGuards(JwtAuthGuard)
@Roles('customer')
export class CustomerAppController {
  constructor(private readonly orders: CustomerOrdersService) {}

  private me(req: Request): string {
    return (req as Request & { user: JwtPayload }).user.sub;
  }

  @Get('active')
  @ApiOperation({ summary: 'Hozirgi faol buyurtma (yo‘q bo‘lsa null)' })
  active(@Req() req: Request) {
    return this.orders.activeOrderId(this.me(req));
  }

  @Post('orders')
  @ApiOperation({ summary: 'Xaritadan tanlangan nuqta bilan buyurtma berish' })
  create(@Req() req: Request, @Body() dto: CreateOrderDto) {
    return this.orders.createOrder(this.me(req), dto.category, dto.pickup);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Kuzatuv: jonli holat, haydovchi, narx, baho' })
  track(@Req() req: Request, @Param('id') id: string) {
    return this.orders.track(this.me(req), id);
  }

  @Post('orders/:id/cancel')
  @ApiOperation({ summary: 'Buyurtmani bekor qilish' })
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.orders.cancel(this.me(req), id);
  }

  @Post('orders/:id/rate')
  @ApiOperation({ summary: 'Haydovchini baholash (1..5)' })
  rate(@Req() req: Request, @Param('id') id: string, @Body() dto: RateDto) {
    return this.orders.rate(this.me(req), id, dto.score);
  }
}
