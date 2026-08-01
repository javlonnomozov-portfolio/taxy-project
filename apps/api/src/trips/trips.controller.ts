import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';
import { TripsService } from './trips.service';

// Haydovchi ilovasi: ishga tushganda faol safarni tiklash uchun.
@ApiTags('trips')
@ApiBearerAuth('jwt')
@Controller('trips')
@UseGuards(JwtAuthGuard)
@Roles('driver')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  /**
   * Javob ATAYLAB `{ trip }` qobig'ida, yalang'och `null` emas.
   *
   * Nest'da `null` qaytarilsa HTTP javob tanasi BO'SH bo'ladi, ilovadagi
   * `api()` esa bo'sh tanani `{}` ga aylantiradi — "safar yo'q" holati
   * truthy bo'lib chiqib, ilova `orderId` siz buzuq safar ekranini ochardi.
   */
  @Get('active')
  @ApiOperation({ summary: 'Hozir yurayotgan safar (yo‘q bo‘lsa trip: null)' })
  async active(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return { trip: await this.trips.activeFor(user.sub) };
  }
}
