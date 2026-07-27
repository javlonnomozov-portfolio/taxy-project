import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PanelRole, VehicleCategory } from '@tty/shared';

export class AssignDto {
  @IsString() driverId!: string;
}

export class CloseDto {
  @IsOptional() @IsString() reason?: string;
}

export class SettingsDto {
  @IsOptional() @IsNumber() surgeMultiplier?: number;
  @IsOptional() @IsBoolean() surgeActive?: boolean;
  /** Jarimasiz bekor qilish oynasi (sekund). */
  @IsOptional() @IsNumber() freeCancelSec?: number;
}

export class TopUpDto {
  /** To'ldirish summasi (so'm). */
  @IsNumber() amount!: number;
  @IsOptional() @IsString() note?: string;
}

export class BillingDto {
  /** subscription | percent | hybrid */
  @IsString() mode!: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class NewVehicleDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() plate?: string;
  @IsEnum(VehicleCategory) category!: VehicleCategory;
}

export class CreateDriverDto {
  @IsString() phone!: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @ValidateNested() @Type(() => NewVehicleDto) vehicle!: NewVehicleDto;
}

export class CreateAdminDto {
  @IsString() login!: string;
  @IsString() @MinLength(6) password!: string;
  @IsEnum(PanelRole) role!: PanelRole;
}
