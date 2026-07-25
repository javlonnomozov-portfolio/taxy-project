import { Body, Controller, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './roles';

class OtpRequestDto {
  @IsString() @MinLength(9) phone!: string;
}
class OtpVerifyDto {
  @IsString() @MinLength(9) phone!: string;
  @IsString() code!: string;
}
class AdminLoginDto {
  @IsString() login!: string;
  @IsString() password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('driver/otp')
  otp(@Body() dto: OtpRequestDto) {
    return this.auth.requestDriverOtp(dto.phone);
  }

  @Public()
  @Post('driver/verify')
  verify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyDriverOtp(dto.phone, dto.code);
  }

  @Public()
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.login, dto.password);
  }
}
