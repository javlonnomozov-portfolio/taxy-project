import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleCategory } from '@tty/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Roles } from '../auth/roles';
import { CustomerOrdersService } from './customer-orders.service';
import { CustomersService } from './customers.service';

class PointDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

class CreateOrderDto {
  @IsEnum(VehicleCategory) category!: VehicleCategory;
  @ValidateNested() @Type(() => PointDto) pickup!: PointDto;
  /** Yo'lovchilar soni — 4 dan ko'p bo'lsa faqat sig'adigan mashinalar taklif oladi. */
  @IsOptional() @IsInt() @Min(1) @Max(8) passengers?: number;
}

/**
 * Kabinetdagi tahrirlanadigan maydonlar (Figma "Client - Profil" ekrani).
 *
 * Telefon ham tahrirlanadi: u KIRISH uchun ishlatilmaydi (mijoz Telegram
 * orqali kiradi), faqat haydovchi qo'ng'iroq qiladigan raqam — ya'ni uni
 * o'zgartirish hisobni egallash yo'lini ochmaydi.
 */
class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsIn(['uz', 'ru']) language?: string;
}

class RateDto {
  @IsInt() @Min(1) @Max(5) score!: number;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

type AddressLabel = 'home' | 'work';

function assertLabel(label: string): AddressLabel {
  if (label !== 'home' && label !== 'work') {
    throw new BadRequestException('label "home" yoki "work" bo\'lishi kerak');
  }
  return label;
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
  constructor(
    private readonly orders: CustomerOrdersService,
    private readonly customers: CustomersService,
  ) {}

  private me(req: Request): string {
    return (req as Request & { user: JwtPayload }).user.sub;
  }

  @Get('profile')
  @ApiOperation({ summary: 'Mijoz profili — Kabinet uchun' })
  async profile(@Req() req: Request) {
    const c = await this.customers.findById(this.me(req));
    return {
      phone: c?.phone ?? null,
      firstName: c?.firstName ?? null,
      lastName: c?.lastName ?? null,
      ratingAvg: c?.ratingAvg ?? 0,
      language: c?.language ?? 'uz',
    };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Kabinetdan profilni tahrirlash (ism/familiya/telefon/til)' })
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    await this.customers.updateProfile(this.me(req), dto);
    // Yangilangan profilni QAYTARAMIZ — ilova ikkinchi so'rov yubormasin va
    // normallashtirilgan telefonni darhol ko'rsatsin.
    return this.profile(req);
  }

  @Get('tariffs')
  @ApiOperation({ summary: 'Toifalar bazaviy narxi bilan ("...dan boshlab")' })
  tariffs() {
    return this.orders.tariffs();
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Saqlangan manzillar — "Uy"/"Ish" tez tugmalari' })
  addresses(@Req() req: Request) {
    return this.customers.getAddresses(this.me(req));
  }

  @Put('addresses/:label')
  @ApiOperation({ summary: 'Joriy nuqtani "Uy"/"Ish" sifatida saqlash (ustiga yozadi)' })
  async saveAddress(
    @Req() req: Request,
    @Param('label') label: string,
    @Body() dto: PointDto,
  ) {
    const l = assertLabel(label);
    await this.customers.saveAddress(this.me(req), l, dto.lat, dto.lng);
    return this.customers.getAddresses(this.me(req));
  }

  @Delete('addresses/:label')
  @ApiOperation({ summary: 'Saqlangan manzilni o\'chirish' })
  async deleteAddress(@Req() req: Request, @Param('label') label: string) {
    const l = assertLabel(label);
    await this.customers.clearAddress(this.me(req), l);
    return this.customers.getAddresses(this.me(req));
  }

  @Get('history')
  @ApiOperation({ summary: 'Tugagan buyurtmalar tarixi' })
  history(@Req() req: Request) {
    return this.orders.history(this.me(req));
  }

  @Get('active')
  @ApiOperation({ summary: 'Hozirgi faol buyurtma (yo‘q bo‘lsa null)' })
  active(@Req() req: Request) {
    return this.orders.activeOrderId(this.me(req));
  }

  @Post('orders')
  @ApiOperation({ summary: 'Xaritadan tanlangan nuqta bilan buyurtma berish' })
  create(@Req() req: Request, @Body() dto: CreateOrderDto) {
    return this.orders.createOrder(this.me(req), dto.category, dto.pickup, dto.passengers);
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
  @ApiOperation({ summary: 'Haydovchini baholash (1..5) + ixtiyoriy izoh' })
  rate(@Req() req: Request, @Param('id') id: string, @Body() dto: RateDto) {
    return this.orders.rate(this.me(req), id, dto.score, dto.comment);
  }
}
