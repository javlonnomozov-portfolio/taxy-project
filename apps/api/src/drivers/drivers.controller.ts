import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsLatitude, IsLongitude, IsString } from 'class-validator';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';

class PushTokenDto {
  @IsString() token!: string;
}
class LocationDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

@Controller('drivers')
@UseGuards(JwtAuthGuard)
@Roles('driver')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  // Haydovchi o'z profili (ilova uchun).
  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.findWithVehicle(user.sub);
  }

  // Expo push tokenini ro'yxatga olish.
  @Post('push-token')
  setPushToken(@Req() req: Request, @Body() dto: PushTokenDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.setPushToken(user.sub, dto.token);
  }

  // Fon rejimida joylashuv (HTTP; socket ochiq bo'lmaganda).
  @Post('location')
  async location(@Req() req: Request, @Body() dto: LocationDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    await this.drivers.updateLocation(user.sub, dto.lat, dto.lng);
    return { ok: true };
  }
}
