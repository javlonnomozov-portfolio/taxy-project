import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GroupNameDto {
  @IsString() @MinLength(1) @MaxLength(60)
  name!: string;
}

export class GroupMemberDto {
  @IsUUID()
  driverId!: string;
}

/**
 * Aksiya. Sanalar `null` bo'lsa cheklanmagan: `startsAt` bo'sh — darhol,
 * `endsAt` bo'sh — qo'lda o'chirilguncha. `groupId` bo'sh — barcha haydovchilar.
 */
export class CreatePromotionDto {
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsISO8601()
  startsAt?: string | null;

  @IsOptional() @IsISO8601()
  endsAt?: string | null;

  @IsOptional() @IsUUID()
  groupId?: string | null;

  /** Odatdagi to'lovdan chegirma: 100 — umuman yechilmaydi. */
  @IsInt() @Min(0) @Max(100)
  commissionDiscountPercent!: number;

  /** Har yakunlangan zakazga bonus (so'm). Yuqori chegara — xato bosishdan himoya. */
  @IsNumber() @Min(0) @Max(100_000)
  bonusPerOrder!: number;
}

export class UpdatePromotionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  name?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsISO8601()
  startsAt?: string | null;

  @IsOptional() @IsISO8601()
  endsAt?: string | null;

  @IsOptional() @IsUUID()
  groupId?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  commissionDiscountPercent?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100_000)
  bonusPerOrder?: number;
}
