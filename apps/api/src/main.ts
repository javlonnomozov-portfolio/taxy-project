import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const config = app.get(ConfigService);
  // Railway PORT'ni beradi; lokalda API_PORT.
  const port = config.get<number>('PORT') ?? config.get<number>('API_PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`TTY API ishga tushdi: port ${port}`);
}

bootstrap();
