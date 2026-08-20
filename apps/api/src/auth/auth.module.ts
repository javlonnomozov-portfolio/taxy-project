import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { CustomerAuthService } from './customer-auth.service';
import { AuthController } from './auth.controller';
import { AdminSeedService } from './admin-seed.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InternalGuard } from './internal.guard';
import { AccountStatusService } from './account-status.service';
import { Driver } from '../entities/driver.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { Customer } from '../entities/customer.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, AdminUser, Customer]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomerAuthService,
    AdminSeedService,
    JwtAuthGuard,
    InternalGuard,
    AccountStatusService,
  ],
  exports: [AuthService, CustomerAuthService, JwtAuthGuard, InternalGuard, AccountStatusService, JwtModule],
})
export class AuthModule {}
