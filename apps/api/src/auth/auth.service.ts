import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { PanelRole } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { Driver } from '../entities/driver.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { JwtPayload } from './roles';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS) private readonly redis: Redis,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
  ) {}

  private isProd(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  /** OTP yaratish va Redis'ga saqlash. Dev rejimda kod javobda qaytariladi. */
  async requestDriverOtp(phone: string): Promise<{ sent: true; devCode?: string }> {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    await this.redis.set(`otp:driver:${phone}`, code, 'EX', 300);
    // TODO: SMS provayder orqali yuborish (keyingi bosqich).
    return this.isProd() ? { sent: true } : { sent: true, devCode: code };
  }

  /** OTP tekshirish → haydovchi yaratiladi/topiladi → JWT. */
  async verifyDriverOtp(phone: string, code: string): Promise<{ token: string; driverId: string }> {
    const stored = await this.redis.get(`otp:driver:${phone}`);
    const devBypass = !this.isProd() && code === '0000';
    if (!devBypass && (!stored || stored !== code)) {
      throw new UnauthorizedException('OTP kod noto‘g‘ri yoki muddati o‘tgan');
    }
    await this.redis.del(`otp:driver:${phone}`);

    let driver = await this.drivers.findOne({ where: { phone } });
    if (!driver) {
      driver = await this.drivers.save(this.drivers.create({ phone }));
    }
    const token = await this.sign({ sub: driver.id, role: 'driver', phone });
    return { token, driverId: driver.id };
  }

  /** Admin panel login (dev: parolni oddiy solishtirish; keyin bcrypt). */
  async adminLogin(login: string, password: string): Promise<{ token: string; role: PanelRole }> {
    const admin = await this.admins.findOne({ where: { login } });
    if (!admin || admin.passwordHash !== password) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    }
    const token = await this.sign({ sub: admin.id, role: admin.role });
    return { token, role: admin.role };
  }

  private sign(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }
}
