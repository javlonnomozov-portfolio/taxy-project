import {
  Matches,
  Max,
  Min,
  IsBoolean,
  IsInt,
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

/**
 * Tarif tahriri (`PUT /ops/tariffs/:category`).
 *
 * NEGA KERAK BO'LDI: bu endpoint `Record<string, number>` qabul qilardi, ya'ni
 * HECH QANDAY tekshiruv yo'q edi va tana to'g'ridan entity'ga `Object.assign`
 * qilinardi. Manfiy narx, 40 barobar surge yoki tasodifiy maydon jimgina
 * saqlanib ketardi — keyin esa mijozga allaqachon hisob chiqarilgan bo'lardi.
 *
 * Yuqori chegaralar ATAYLAB qo'yilgan: ular "haqiqiy narx" emas, xato bosishdan
 * himoya (masalan 5 000 o'rniga 500 000 yozib yuborish).
 */
export class UpdateTariffDto {
  /** Mashinaga o'tirish haqi (so'm). */
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) baseFare?: number;
  /** 1 km uchun (so'm). */
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) perKm?: number;
  /** Bepul daqiqalardan keyingi har daqiqa uchun (so'm). */
  @IsOptional() @IsNumber() @Min(0) @Max(100_000) waitingPerMin?: number;
  /** Haydovchi bepul kutadigan daqiqalar. */
  @IsOptional() @IsInt() @Min(0) @Max(120) freeWaitMin?: number;
  /** Tungi tarif boshlanishi, "HH:MM". */
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'nightFrom HH:MM shaklida bo\'lishi kerak' })
  nightFrom?: string;
  /** Tungi tarif tugashi, "HH:MM". Yarim tundan o'tishi mumkin (22:00 -> 06:00). */
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'nightTo HH:MM shaklida bo\'lishi kerak' })
  nightTo?: string;
  /** Tungi koeffitsient (1 = qimmatlashmaydi). */
  @IsOptional() @IsNumber() @Min(1) @Max(5) nightMultiplier?: number;
  /** Shu toifaning qimmatlashuv koeffitsienti (bosh kalit yoqilganda ishlaydi). */
  @IsOptional() @IsNumber() @Min(1) @Max(5) surgeMultiplier?: number;
}

/**
 * Buyurtma narxini tuzatish (`POST /ops/orders/:id/fare`).
 *
 * Manfiy qiymat ham mumkin (chegirma — masalan haydovchi kech kelgani
 * uchun), lekin yakuniy hisob nolga tushib ketmaydi.
 *
 * `reason` MAJBURIY: summa sababsiz o'zgarsa, mijoz uchun ham, keyinchalik
 * nizo chiqqanda operator uchun ham tushunarsiz bo'lardi.
 */
export class FareAdjustmentDto {
  /** Qo'shimcha (so'm). Manfiy — chegirma. */
  @IsNumber() @Min(-1_000_000) @Max(1_000_000) amount!: number;
  /** Nima uchun — mijoz hisobda shuni ko'radi. */
  @IsString() @MinLength(3) reason!: string;
}

export class SettingsDto {
  /** Yangi toifa uchun boshlang'ich koeffitsient (amaldagi narx TARIFDAN olinadi). */
  @IsOptional() @IsNumber() @Min(1) @Max(5) surgeMultiplier?: number;
  /** Qimmatlashuvning BOSH KALITI — o'chirilsa hech bir toifada qo'llanmaydi. */
  @IsOptional() @IsBoolean() surgeActive?: boolean;
  /** Jarimasiz bekor qilish oynasi (sekund). */
  @IsOptional() @IsNumber() freeCancelSec?: number;
  /** `per_order` rejimida har zakaz uchun olinadigan summa (so'm). */
  @IsOptional() @IsNumber() @Min(0) perOrderFee?: number;
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
  /** Yo'lovchi o'rinlari: Damas 7, Cobalt/Nexia 4. Berilmasa 4. */
  @IsOptional() @IsInt() @Min(1) @Max(8) seats?: number;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() plate?: string;
  /** Yo'lovchi o'rinlari — 5+ yo'lovchi filtri shu qiymatga tayanadi. */
  @IsOptional() @IsInt() @Min(1) @Max(8) seats?: number;
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
