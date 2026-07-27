import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // MUHIM (Railway/proksi ortida): busiz `req.ip` har doim proksi IP'si bo'ladi va
  // login rate-limit BARCHA foydalanuvchilarni bitta hisoblagichga qo'shib, hammani
  // bloklab qo'yardi. Bitta ishonchli proksi (Railway edge) hisobga olinadi.
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  // Deploy/qayta ishga tushishda dispatch taymerlarini tartibli yopish uchun
  // (DispatchService.onModuleDestroy) — busiz haydovchi ilovasida osilgan taklif qolardi.
  app.enableShutdownHooks();

  const config = app.get(ConfigService);

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
