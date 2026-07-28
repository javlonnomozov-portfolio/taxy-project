import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /**
   * Railway `healthcheckPath` = /health.
   * Terminus nosozlikda **503** qaytaradi (avval 200 + `status: 'degraded'` edi) —
   * bu to'g'riroq: DB'siz servis sog'lom emas va deploy o'tkazilmasligi kerak.
   */
  @Get()
  @ApiOperation({ summary: 'Servis holati (DB + Redis)' })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
