import {
  IsEnum,
  IsInt,
  IsISO8601,
  Max,
  Min,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, VehicleCategory } from '@tty/shared';

export class PointDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

export class CreateOrderDto {
  @IsString() customerId!: string;
  @IsEnum(VehicleCategory) category!: VehicleCategory;
  /** Olib ketish nuqtasi. */
  @ValidateNested() @Type(() => PointDto) pickup!: PointDto;
  @IsOptional() @IsString() pickupAddress?: string;
  /** Manzil ixtiyoriy — taksometr haqiqiy km bo'yicha hisoblaydi. */
  @IsOptional() @ValidateNested() @Type(() => PointDto) destination?: PointDto;
  @IsOptional() @IsString() destAddress?: string;
  @IsOptional() @IsString() note?: string;
  /**
   * Yo'lovchilar soni — 4 dan ko'p bo'lsa dispatch faqat sig'adigan
   * mashinalarga taklif yuboradi. Berilmasa filtr umuman ishlamaydi.
   */
  @IsOptional() @IsInt() @Min(1) @Max(8) passengers?: number;
  @IsOptional() @IsEnum(OrderType) orderType?: OrderType;
  /** Oldindan buyurtma vaqti (ISO 8601), `orderType=scheduled` bilan. */
  @IsOptional() @IsISO8601() scheduledAt?: string;
}

export class CancelOrderDto {
  @IsOptional() @IsString() reason?: string;
}
