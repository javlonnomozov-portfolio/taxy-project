import { Body, Controller, Get, Header, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { MiniappService, TrackView } from './miniapp.service';
import { miniappPage } from './miniapp.page';

class TrackDto {
  // Telegram imzolagan query-string. Uzunligi chegaralangan — bu yagona
  // autentifikatsiya kiritmasi, cheksiz katta body qabul qilmaymiz.
  @IsString()
  @MaxLength(4096)
  initData!: string;

  @IsString()
  @MaxLength(64)
  orderId!: string;
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
}
