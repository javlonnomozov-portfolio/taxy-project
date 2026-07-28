import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { corsOptions, parseOrigins } from './config/cors';
import { CorsSocketAdapter } from './realtime/cors-socket.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // MUHIM (Railway/proksi ortida): busiz `req.ip` har doim proksi IP'si bo'ladi va
  // login rate-limit BARCHA foydalanuvchilarni bitta hisoblagichga qo'shib, hammani
  // bloklab qo'yardi. Bitta ishonchli proksi (Railway edge) hisobga olinadi.
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  // Standart himoya sarlavhalari. API JSON qaytaradi va brauzerda sahifa
  // ko'rsatmaydi, shuning uchun CSP shart emas; `crossOriginResourcePolicy`
  // esa Swagger UI statikasiga xalaqit bermasligi uchun yumshatilgan.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const config = app.get(ConfigService);
  // CORS: prod'da faqat ro'yxatdagi origin'lar (admin domeni). Busiz istalgan
  // sayt brauzerdan admin tokeni bilan API'ga so'rov yubora olardi.
  const origins = parseOrigins(config.get<string>('CORS_ORIGINS'));
  app.enableCors(corsOptions(origins));
  // Socket.IO: bir xil CORS qoidasi + Redis adapter (ko'p instansiya uchun).
  const wsAdapter = new CorsSocketAdapter(app, origins);
  await wsAdapter.connectToRedis(config.get<string>('REDIS_URL')!);
  app.useWebSocketAdapter(wsAdapter);
  app.get(Logger).log(
    origins ? `CORS ruxsat etilgan: ${origins.join(', ')}` : 'CORS: hammaga ochiq (dev)',
  );

  // Deploy/qayta ishga tushishda dispatch taymerlarini tartibli yopish uchun
  // (DispatchService.onModuleDestroy) — busiz haydovchi ilovasida osilgan taklif qolardi.
  app.enableShutdownHooks();

  // OpenAPI — 3 ta klient (bot, admin, driver-app) shu shartnomaga tayanadi.
  // Prod'da yopiq: SWAGGER_ENABLED=true bo'lsagina ochiladi.
  const isProd = config.get<string>('NODE_ENV') === 'production';
  if (!isProd || config.get<string>('SWAGGER_ENABLED') === 'true') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Toy TaxY API')
        .setDescription('TTY taksi platformasi — HTTP API. Realtime qismi Socket.IO orqali.')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'jwt')
        .addApiKey({ type: 'apiKey', name: 'x-internal-key', in: 'header' }, 'internal')
        .build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  // Railway PORT'ni beradi; lokalda API_PORT.
  const port = config.get<number>('PORT') ?? config.get<number>('API_PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`TTY API ishga tushdi: port ${port}`);
}

bootstrap();
