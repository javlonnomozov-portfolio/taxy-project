import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InternalGuard } from './internal.guard';
import { Driver } from '../entities/driver.entity';
import { AdminUser } from '../entities/admin-user.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, AdminUser]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, InternalGuard],
  exports: [AuthService, JwtAuthGuard, InternalGuard, JwtModule],
})
export class AuthModule {}
