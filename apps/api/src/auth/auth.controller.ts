import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PanelRole } from '@tty/shared';
import { Public, Roles, JwtPayload, AuthRole } from './roles';

class DriverLoginDto {
  @IsString() @MinLength(9) phone!: string;
  @IsString() password!: string;
}
class ChangePasswordDto {
  @IsString() @MinLength(6) newPassword!: string;
}
class AdminLoginDto {
  @IsString() login!: string;
  @IsString() password!: string;
}
class AdminChangePasswordDto {
  @IsString() @MinLength(6) newPassword!: string;
}
const PANEL: AuthRole[] = [PanelRole.SUPER_ADMIN, PanelRole.ADMIN, PanelRole.OPERATOR];

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('driver/login')
  driverLogin(@Body() dto: DriverLoginDto) {
    return this.auth.driverLogin(dto.phone, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('driver')
  @Post('driver/change-password')
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.auth.changeDriverPassword(user.sub, dto.newPassword);
  }

  @Public()
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.login, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PANEL)
  @Post('admin/change-password')
  adminChangePassword(@Req() req: Request, @Body() dto: AdminChangePasswordDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.auth.changeAdminPassword(user.sub, dto.newPassword);
  }
}
