import { IsLatitude, IsLongitude, IsString } from 'class-validator';

export class PushTokenDto {
  /** Expo push token (ExponentPushToken[...]). */
  @IsString() token!: string;
}

export class LocationDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}
