import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { RealtimeCoreModule } from './realtime/realtime-core.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { DriversModule } from './drivers/drivers.module';
import { OrdersModule } from './orders/orders.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { OffersModule } from './offers/offers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SettingsModule } from './settings/settings.module';
import { PricingModule } from './pricing/pricing.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TripsModule } from './trips/trips.module';
import { ReputationModule } from './reputation/reputation.module';
import { OpsModule } from './ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Har so'rovga id — zakaz oqimini (HTTP → dispatch → socket) loglardan yig'ish uchun.
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // MUHIM: busiz pino-http Authorization sarlavhasi va parollarni loglarga yozadi.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-internal-key"]',
            'req.body.password',
            'req.body.newPassword',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    // Rate limiting. ATAYLAB GLOBAL GUARD SIFATIDA QO'YILMAGAN — bot va haydovchi
    // ilovasi yuqori chastotada chaqiradi (joylashuv, holat pollingi) va global chek
    // ularni sindirishi mumkin. Faqat login endpointlariga qo'llanadi (AuthController),
    // ya'ni parolni brute force qilishning oldi olinadi.
    // Saqlash xotirada — bu 1 instansiya cheklovimizga mos (docs/deploy-railway.md).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { name: 'default', ttl: 60_000, limit: config.get<number>('LOGIN_RATE_LIMIT')! },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: config.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),
    RedisModule,
    RealtimeCoreModule,
    SettingsModule,
    PricingModule,
    BillingModule,
    NotificationsModule,
    AuthModule,
    HealthModule,
    CustomersModule,
    DriversModule,
    TripsModule,
    ReputationModule,
    OrdersModule,
    DispatchModule,
    OffersModule,
    OpsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
