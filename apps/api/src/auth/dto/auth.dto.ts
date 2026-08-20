import { IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class DriverLoginDto {
  /** Haydovchi telefon raqami (masalan +998901234567). */
  @IsString() @MinLength(9) phone!: string;
  /** Parol (super-admin bergan temp yoki haydovchi qo'ygani). */
  @IsString() password!: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(6) newPassword!: string;
}

export class AdminLoginDto {
  @IsString() login!: string;
  @IsString() password!: string;
}

export class AdminChangePasswordDto {
  @IsString() @MinLength(6) newPassword!: string;
}

// ---- Mijoz ilovasi kirishi (Telegram bot orqali) ----

export class CustomerStartDto {
  /** Faqat chastota chegarasi uchun — saqlanmaydi. */
  @IsOptional() @IsString() @MaxLength(128) deviceId?: string;
}

export class CustomerNonceDto {
  @IsString() @MaxLength(64) nonce!: string;
}

export class CustomerConfirmDto extends CustomerNonceDto {
  @IsString() @MaxLength(32) telegramId!: string;
}

export class CustomerVerifyDto extends CustomerNonceDto {
  @IsString() @Length(6, 6) code!: string;
}
