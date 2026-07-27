import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

/**
 * Redis health indikatori. MUHIM: ilovaning MAVJUD ulanishini ishlatadi —
 * avval HealthController o'ziga alohida `new Redis(...)` ochardi, ya'ni health
 * "ok" bo'lsa ham ilovaning haqiqiy ulanishi uzilgan bo'lishi mumkin edi.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true, { status: this.redis.status });
    } catch (e) {
      throw new HealthCheckError(
        'Redis javob bermadi',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
