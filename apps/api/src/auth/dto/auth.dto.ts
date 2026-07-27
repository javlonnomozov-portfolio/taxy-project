import { IsString, MinLength } from 'class-validator';

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
