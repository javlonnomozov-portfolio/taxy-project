import { IsOptional, IsString } from 'class-validator';

export class UpsertCustomerDto {
  /** Telegram foydalanuvchi id (raqamli — DB'da bigint). */
  @IsString() telegramId!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  /** uz | ru */
  @IsOptional() @IsString() language?: string;
}
