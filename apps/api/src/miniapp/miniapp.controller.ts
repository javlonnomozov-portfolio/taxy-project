import { Body, Controller, Get, Header, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  IsEnum,
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
import { MiniappService, TrackView } from './miniapp.service';
import { miniappPage } from './miniapp.page';

class InitDataDto {
  // Telegram imzolagan query-string. Uzunligi chegaralangan — bu yagona
  // autentifikatsiya kiritmasi, cheksiz katta body qabul qilmaymiz.
  @IsString()
  @MaxLength(4096)
  initData!: string;
}

class TrackDto extends InitDataDto {
  @IsString()
  @MaxLength(64)
  orderId!: string;
}

class RateDto extends TrackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

class PickupDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

class CreateOrderDto extends InitDataDto {
  @IsEnum(VehicleCategory)
  category!: VehicleCategory;

  @ValidateNested()
  @Type(() => PickupDto)
  pickup!: PickupDto;

  /** Yo'lovchilar soni — ilova bilan bir xil (kanal pariteti). */
  @IsOptional() @IsInt() @Min(1) @Max(8) passengers?: number;
}

/**
 * Telegram Mini App — mijoz "Taksi qayerda?" tugmasini bosganda ochiladigan
 * jonli xarita.
 *
 * DIQQAT: bu yagona OCHIQ (guard'siz) controller. Himoya `initData` imzosida:
 * har so'rovda Telegram imzosi tekshiriladi va zakaz aynan shu foydalanuvchiniki
 * ekani solishtiriladi (`MiniappService.track`). Shuning uchun `InternalGuard`
 * ham, JWT ham qo'llanmaydi — Telegram ichidagi brauzerda ularning ikkalasi
 * ham yo'q.
 */
@ApiExcludeController()
@Controller('miniapp')
export class MiniappController {
  constructor(private readonly miniapp: MiniappService) {}

  @Get('track')
  @Header('content-type', 'text/html; charset=utf-8')
  // Sahifa o'zgarmas — Telegram brauzeri keshlasin, lekin uzoq emas (deploy'dan
  // keyin yangisi olinsin).
  @Header('cache-control', 'public, max-age=300')
  page(): string {
    return miniappPage();
  }

  // POST — chunki `initData` body'da ketadi (URL'da qolib ketmasin), lekin bu
  // O'QISH amali: 201 emas, 200.
  @Post('track')
  @HttpCode(200)
  track(@Body() dto: TrackDto): Promise<TrackView> {
    return this.miniapp.track(dto.initData, dto.orderId);
  }

  /** Sahifa ochilganda: kuzatuv rejimimi yoki yangi buyurtma rejimi? */
  @Post('state')
  @HttpCode(200)
  state(@Body() dto: InitDataDto): Promise<{ orderId: string | null }> {
    return this.miniapp.activeOrderId(dto.initData);
  }

  /** Safar yakunlangach haydovchini baholash (bot chatidagi yulduzlar bilan bir xil). */
  @Post('rate')
  @HttpCode(200)
  rate(@Body() dto: RateDto): Promise<{ ok: true }> {
    return this.miniapp.rate(dto.initData, dto.orderId, dto.score);
  }

  /** Buyurtmani bekor qilish (bot chatidagi tugma bilan bir xil qoidalar). */
  @Post('cancel')
  @HttpCode(200)
  cancel(@Body() dto: TrackDto): Promise<{ penalized: boolean }> {
    return this.miniapp.cancel(dto.initData, dto.orderId);
  }

  /** Xaritadan tanlangan nuqta bilan buyurtma berish. */
  @Post('order')
  create(@Body() dto: CreateOrderDto): Promise<{ orderId: string }> {
    return this.miniapp.createOrder(dto.initData, dto.category, dto.pickup, dto.passengers);
  }
}
