import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_TEXT_LEN, MAX_VOICE_SEC } from './chat.media';

export class ChatTextDto {
  @IsString() @MinLength(1) @MaxLength(MAX_TEXT_LEN)
  body!: string;
}

/** Multipart maydonlari matn bo'lib keladi — `@Type` songa aylantiradi. */
export class ChatMediaDto {
  @IsIn(['voice', 'image'])
  kind!: 'voice' | 'image';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_VOICE_SEC)
  durationSec?: number;
}

export class ChatBeforeQuery {
  /** Shu vaqtdan ESKI xabarlar (orqaga sahifalash). */
  @IsOptional() @IsISO8601()
  before?: string;
}
