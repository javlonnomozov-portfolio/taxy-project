import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PanelRole } from '@tty/shared';
import { Driver } from '../entities/driver.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { JwtPayload } from './roles';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
  ) {}

  /** Haydovchi kirishi: telefon + parol (super-admin bergan temp yoki o'zi qo'ygan). */
  async driverLogin(
    phone: string,
    password: string,
  ): Promise<{ token: string; driverId: string; mustChangePassword: boolean }> {
    const driver = await this.drivers.findOne({ where: { phone } });
    if (!driver || !driver.passwordHash) {
      throw new UnauthorizedException('Telefon yoki parol noto‘g‘ri');
    }
    const ok = await bcrypt.compare(password, driver.passwordHash);
    if (!ok) throw new UnauthorizedException('Telefon yoki parol noto‘g‘ri');

    const token = await this.sign({ sub: driver.id, role: 'driver', phone });
    return { token, driverId: driver.id, mustChangePassword: driver.mustChangePassword };
  }

  /** Birinchi kirishdan keyin (yoki istalgan payt) parolni almashtirish. */
  async changeDriverPassword(driverId: string, newPassword: string): Promise<{ ok: true }> {
    if (!newPassword || newPassword.length < 6) {
      throw new UnauthorizedException('Parol kamida 6 belgidan iborat bo‘lsin');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.drivers.update(driverId, { passwordHash: hash, mustChangePassword: false });
    return { ok: true };
  }

  /** Admin panel login (bcrypt). */
  async adminLogin(login: string, password: string): Promise<{ token: string; role: PanelRole }> {
    const admin = await this.admins.findOne({ where: { login } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    }
    const token = await this.sign({ sub: admin.id, role: admin.role });
    return { token, role: admin.role };
  }

  async changeAdminPassword(adminId: string, newPassword: string): Promise<{ ok: true }> {
    if (!newPassword || newPassword.length < 6) {
      throw new UnauthorizedException('Parol kamida 6 belgidan iborat bo‘lsin');
    }
    await this.admins.update(adminId, { passwordHash: await bcrypt.hash(newPassword, 10) });
    return { ok: true };
  }

  /** Yangi admin/operator yaratish (super-admin). */
  async createAdmin(login: string, password: string, role: PanelRole): Promise<AdminUser> {
    const existing = await this.admins.findOne({ where: { login } });
    if (existing) throw new UnauthorizedException('Bunday login allaqachon mavjud');
    return this.admins.save(
      this.admins.create({ login, role, passwordHash: await bcrypt.hash(password, 10) }),
    );
  }

  static hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private sign(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }
}
