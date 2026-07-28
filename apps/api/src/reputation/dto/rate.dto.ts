import { IsObject, IsOptional, IsString } from 'class-validator';

export class RateDto {
  @IsString() orderId!: string;
  /** Kategoriya → baho (1–5). Masalan `{ "xushmuomalalik": 5, "tozalik": 4 }`. */
  @IsObject() scores!: Record<string, number>;
  @IsOptional() @IsString() comment?: string;
}
