import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { VehicleCategory } from '@tty/shared';
import { REDIS } from '../redis/redis.module';

// Jonli haydovchi joylashuvi va radius qidiruv — Redis GEO.
// Har mashina toifasi uchun alohida geo-set (dispatch toifa filtri uchun).
@Injectable()
export class GeoService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(category: VehicleCategory): string {
    return `geo:drivers:${category}`;
  }

  /** Onlayn (ONLINE_IDLE) haydovchi joylashuvini yangilash. */
  async setDriverLocation(
    driverId: string,
    category: VehicleCategory,
    lng: number,
    lat: number,
  ): Promise<void> {
    await this.redis.geoadd(this.key(category), lng, lat, driverId);
  }

  /** Haydovchini geo-indeksdan olib tashlash (oflayn / band bo'lganda). */
  async removeDriver(driverId: string, category: VehicleCategory): Promise<void> {
    await this.redis.zrem(this.key(category), driverId);
  }

  async removeFromAll(driverId: string): Promise<void> {
    await Promise.all(
      Object.values(VehicleCategory).map((c) => this.redis.zrem(this.key(c), driverId)),
    );
  }

  /**
   * Berilgan nuqtadan radius (metr) ichidagi eng yaqin haydovchilar —
   * masofa bo'yicha tartiblangan (eng yaqin birinchi).
   */
  async nearestDrivers(
    category: VehicleCategory,
    lng: number,
    lat: number,
    radiusM: number,
    count: number,
  ): Promise<Array<{ driverId: string; distanceM: number }>> {
    // GEOSEARCH ... BYRADIUS ... ASC — eng yaqindan uzoqqa.
    const res = (await this.redis.geosearch(
      this.key(category),
      'FROMLONLAT',
      lng,
      lat,
      'BYRADIUS',
      radiusM,
      'm',
      'ASC',
      'COUNT',
      count,
      'WITHDIST',
    )) as Array<[string, string]>;

    return res.map(([driverId, dist]) => ({ driverId, distanceM: Math.round(Number(dist)) }));
  }
}
