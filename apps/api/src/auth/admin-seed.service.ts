import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PanelRole } from '@tty/shared';
import { AdminUser } from '../entities/admin-user.entity';

// Ishga tushganda bootstrap super-admin yaratadi (faqat mavjud bo'lmasa).
// ADMIN_LOGIN (default 'admin') + ADMIN_PASSWORD env'dan. Parol berilmasa va admin
// yo'q bo'lsa — tasodifiy parol yaratilib logga chiqadi (dev).
@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly log = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const login = this.config.get<string>('ADMIN_LOGIN') ?? 'admin';
    const existing = await this.admins.findOne({ where: { login } });
    if (existing) return; // mavjud — tegmaymiz (parol almashtirilishi mumkin)

    let password = this.config.get<string>('ADMIN_PASSWORD');
    let generated = false;
    if (!password) {
      password = Math.random().toString(36).slice(2, 12);
      generated = true;
    }
    await this.admins.save(
      this.admins.create({
        login,
        role: PanelRole.SUPER_ADMIN,
        passwordHash: await bcrypt.hash(password, 10),
      }),
    );
    if (generated) {
      this.log.warn(`Bootstrap super-admin yaratildi — login: ${login}, parol: ${password}`);
    } else {
      this.log.log(`Bootstrap super-admin yaratildi — login: ${login}`);
    }
  }
}
