import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleCategory } from '@tty/shared';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';

class VehicleDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() plate?: string;
  @IsEnum(VehicleCategory) category!: VehicleCategory;
}
class RegisterDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @ValidateNested() @Type(() => VehicleDto) vehicle!: VehicleDto;
}

@Controller('drivers')
@UseGuards(JwtAuthGuard)
@Roles('driver')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Post('register')
  register(@Req() req: Request, @Body() dto: RegisterDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.register(user.sub, dto);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.drivers.findWithVehicle(user.sub);
  }
}
