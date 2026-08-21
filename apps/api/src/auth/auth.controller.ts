import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { PanelRole } from '@tty/shared';
import { Public, Roles, JwtPayload, AuthRole } from './roles';
import {
  AdminChangePasswordDto,
  AdminLoginDto,
  ChangePasswordDto,
  CustomerConfirmDto,
  CustomerNonceDto,
  CustomerStartDto,
  CustomerVerifyDto,
  DriverLoginDto,
} from './dto/auth.dto';
import { CustomerAuthService } from './customer-auth.service';
import { InternalGuard } from './internal.guard';

const PANEL: AuthRole[] = [PanelRole.SUPER_ADMIN, PanelRole.ADMIN, PanelRole.OPERATOR];

// Parolni brute force qilishdan himoya. Limit `LOGIN_RATE_LIMIT` env'idan
// (default 5/daqiqa), kalit = IP + telefon/login — qarang LoginThrottlerGuard.
// Guard SHU CONTROLLER'da (global emas) — bot va haydovchi ilovasining tez-tez
// chaqiruvlariga (joylashuv, status pollingi) umuman tegmaydi.

@ApiTags('auth')
@Controller('auth')
@UseGuards(LoginThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly customerAuth: CustomerAuthService,
  ) {}

  @Public()
  @Post('driver/login')
  @ApiOperation({ summary: 'Haydovchi kirishi (telefon + parol)' })
  @ApiResponse({ status: 429, description: 'Juda ko‘p urinish — 1 daqiqadan keyin qayta uring' })
  driverLogin(@Body() dto: DriverLoginDto) {
    return this.auth.driverLogin(dto.phone, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('driver')
  @ApiBearerAuth('jwt')
  @Post('driver/change-password')
  @ApiOperation({ summary: 'Haydovchi parolini almashtirish (birinchi kirishda majburiy)' })
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.auth.changeDriverPassword(user.sub, dto.newPassword);
  }

  @Public()
  @Post('admin/login')
  @ApiOperation({ summary: 'Panel kirishi (admin/operator)' })
  @ApiResponse({ status: 429, description: 'Juda ko‘p urinish — 1 daqiqadan keyin qayta uring' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.login, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PANEL)
  @ApiBearerAuth('jwt')
  @Post('admin/change-password')
  @ApiOperation({ summary: 'Panel foydalanuvchisi parolini almashtirish' })
  adminChangePassword(@Req() req: Request, @Body() dto: AdminChangePasswordDto) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.auth.changeAdminPassword(user.sub, dto.newPassword);
  }

  // ---- Mijoz ilovasi kirishi ----
  //
  // Uchala endpoint ham `Public`: mijozda hali token yo'q. Himoya nonce'ning
  // taxmin qilib bo'lmasligida va bot tasdig'ida (`confirm` ichki kalit bilan).

  @Public()
  @Post('customer/start')
  @ApiOperation({ summary: 'Kirishni boshlash — nonce va Telegram deep link' })
  customerStart(@Body() dto: CustomerStartDto) {
    return this.customerAuth.start(dto.deviceId);
  }

  // Botdan keladi (ichki kalit) — foydalanuvchi `/start <nonce>` bosgani.
  @Public()
  @UseGuards(InternalGuard)
  @ApiSecurity('internal')
  @Post('customer/confirm')
  @ApiOperation({ summary: 'Bot: kirishni tasdiqlash, 6 xonali kod qaytaradi' })
  customerConfirm(@Body() dto: CustomerConfirmDto) {
    return this.customerAuth.confirm(dto.nonce, dto.telegramId);
  }

  @Public()
  @Post('customer/poll')
  @ApiOperation({ summary: 'Ilova: bot tasdiqladimi (token BERMAYDI — kod kerak)' })
  customerPoll(@Body() dto: CustomerNonceDto) {
    return this.customerAuth.poll(dto.nonce);
  }

  @Public()
  @Post('customer/verify')
  @ApiOperation({ summary: 'Ilova: 6 xonali kod bilan kirish (MAJBURIY qadam)' })
  customerVerify(@Body() dto: CustomerVerifyDto) {
    return this.customerAuth.verify(dto.nonce, dto.code);
  }
}
