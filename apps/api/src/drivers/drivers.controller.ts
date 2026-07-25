import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';

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
}
