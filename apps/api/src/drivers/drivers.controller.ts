import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';
import { LocationDto, PushTokenDto } from './dto/driver.dto';

@ApiTags('drivers')
@ApiBearerAuth('jwt')
@Controller('drivers')
@UseGuards(JwtAuthGuard)
@Roles('driver')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get('me')
  @ApiOperation({ summary: 'Haydovchi o‘z profili (mashina bilan)' })
  async me(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.findWithVehicle(user.sub);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Expo push tokenini ro‘yxatga olish' })
  setPushToken(@Req() req: Request, @Body() dto: PushTokenDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.setPushToken(user.sub, dto.token);
  }

  @Post('location')
  @ApiOperation({ summary: 'Fon rejimida joylashuv (socket ochiq bo‘lmaganda)' })
  async location(@Req() req: Request, @Body() dto: LocationDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    await this.drivers.updateLocation(user.sub, dto.lat, dto.lng);
    return { ok: true };
  }

  // --- Haydovchining o'z ma'lumotlari (ilovadagi "Kabinet" ekranlari) ---

  @Get('me/balance')
  @ApiOperation({ summary: 'Balans va billing rejimi' })
  balance(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.balanceInfo(user.sub);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'Balans harakati (komissiya, to‘ldirish)' })
  transactions(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.transactions(user.sub);
  }

  @Get('me/trips')
  @ApiOperation({ summary: 'Safarlar tarixi (so‘nggi 50 ta)' })
  trips(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.tripHistory(user.sub);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Reyting va metrikalar (qabul/bekor/yakunlash)' })
  stats(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.stats(user.sub);
  }
}
