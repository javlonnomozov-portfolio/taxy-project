import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ApprovalStatus } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { Driver } from '../entities/driver.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { AuthRole } from './roles';

/**
 * JWT 7 kun amal qiladi, shuning uchun token BERILGANDAN KEYIN hisob bloklansa
 * (yoki o'chirilsa) eski token baribir ishlayverardi — bloklangan haydovchi
 * socketga ulanib zakaz qabul qila olardi. Bu servis har so'rovda hisob hali
 * haqiqiy ekanini tekshiradi.
 *
 * Unumdorlik: natija Redis'da qisqa TTL bilan keshlanadi, ya'ni har so'rovda DB'ga
 * bormaymiz. Bloklashda kesh DARHOL tozalanadi (`invalidate`), shuning uchun blok
 * bir zumda kuchga kiradi. Redis tozalansa — kesh promoqchi bo'ladi va DB'dan
 * qayta o'qiladi, ya'ni xatolik xavfsiz tomonga (qat'iyroq tekshiruvga) og'adi.
 */
@Injectable()
export class AccountStatusService {
  private readonly log = new Logger(AccountStatusService.name);
  private static readonly TTL_SEC = 15;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
  ) {}

  private key(role: AuthRole, id: string): string {
    return `acct:${role === 'driver' ? 'driver' : 'admin'}:${id}`;
  }

  /** Hisob hali faolmi (haydovchi bloklanmagan / panel foydalanuvchisi mavjud). */
  async isActive(role: AuthRole, id: string): Promise<boolean> {
    const key = this.key(role, id);
    const cached = await this.redis.get(key).catch(() => null);
    if (cached !== null) return cached === '1';

    const active = role === 'driver' ? await this.driverActive(id) : await this.adminExists(id);
    await this.redis.set(key, active ? '1' : '0', 'EX', AccountStatusService.TTL_SEC).catch(() => {});
    return active;
  }

  private async driverActive(id: string): Promise<boolean> {
    const d = await this.drivers.findOne({ where: { id }, select: { id: true, approvalStatus: true } });
    return !!d && d.approvalStatus !== ApprovalStatus.BLOCKED;
  }

  private async adminExists(id: string): Promise<boolean> {
    return (await this.admins.countBy({ id })) > 0;
  }

  /** Holat o'zgarganda (blok/ochish/o'chirish) keshni darhol tozalash. */
  async invalidate(role: AuthRole, id: string): Promise<void> {
    await this.redis.del(this.key(role, id)).catch(() => {});
    this.log.log(`Hisob keshi tozalandi: ${role}/${id}`);
  }
}
