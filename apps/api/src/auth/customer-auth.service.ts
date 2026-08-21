import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { Customer } from '../entities/customer.entity';
import { JwtPayload } from './roles';

/**
 * Mijoz ilovasiga kirish — Telegram bot orqali.
 *
 * NEGA SHUNDAY: mijoz allaqachon botda ro'yxatdan o'tgan (telefon raqami bor).
 * SMS yuborish xarajat, alohida parol esa yangi hujum yuzasi bo'lardi.
 * Telegram identifikatsiya manbai bo'lib qoladi.
 *
 * KOD MAJBURIY — tasdiqlashning O'ZI yetarli emas.
 *
 * Avval `poll` tasdiqlangan zahoti token berardi. Bu HISOBNI O'G'IRLASH
 * yo'lini ochardi: hujumchi o'z ilovasida nonce yaratib, deep link'ni
 * qurbonga yuboradi ("shuni bosib bering"), qurbon Telegram'da tasdiqlaydi
 * va HUJUMCHINING ilovasi qurbon hisobiga kirib oladi. Tasdiqlovchi va
 * ilovani ushlab turgan odam BOSHQA-BOSHQA bo'lishi mumkin edi.
 *
 * Endi kod bot chatida ko'rsatiladi va uni ILOVA TURGAN QURILMAGA kiritish
 * shart — bu ikkalasi bir odam ekanini bog'laydi. `poll` faqat "tasdiqlandi,
 * endi kodni kiriting" holatini qaytaradi, token BERMAYDI.
 */
@Injectable()
export class CustomerAuthService {
  private readonly log = new Logger(CustomerAuthService.name);

  /** Nonce va kod amal qilish muddati. */
  private static readonly TTL_SEC = 300; // 5 daqiqa
  /** Kodni tanlab olishga qarshi: shuncha xato urinishdan keyin nonce o'ladi. */
  private static readonly MAX_ATTEMPTS = 5;
  /** Bir qurilma daqiqasiga nechta nonce so'ray oladi. */
  private static readonly MAX_STARTS_PER_MIN = 5;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private key(nonce: string): string {
    return `auth:nonce:${nonce}`;
  }

  /**
   * 1-qadam: ilova nonce so'raydi va deep link'ni ochadi.
   *
   * `deviceId` — faqat chastota chegarasi uchun; hech qayerda saqlanmaydi.
   */
  async start(deviceId?: string): Promise<{
    nonce: string;
    deepLink: string;
    expiresInSec: number;
  }> {
    await this.rateLimitStart(deviceId);

    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (!botUsername) {
      // Jimgina bo'sh havola qaytarish eng yomon variant — ilova nima
      // qilishini bilmay qolardi.
      throw new BadRequestException('TELEGRAM_BOT_USERNAME sozlanmagan');
    }

    // 32 bayt — taxmin qilib bo'lmaydi. Kod qisqa (6 xona), lekin u FAQAT
    // nonce bilan birga ishlaydi, ya'ni kodni yakka o'zi tanlash foydasiz.
    const nonce = randomBytes(24).toString('base64url');
    await this.redis.set(
      this.key(nonce),
      JSON.stringify({ status: 'pending', attempts: 0 }),
      'EX',
      CustomerAuthService.TTL_SEC,
    );

    return {
      nonce,
      deepLink: `https://t.me/${botUsername}?start=${nonce}`,
      expiresInSec: CustomerAuthService.TTL_SEC,
    };
  }

  /**
   * 2-qadam: bot `/start <nonce>` ni olgach chaqiradi (ichki kalit bilan).
   * Javobdagi kodni bot chatga yozadi.
   */
  async confirm(nonce: string, telegramId: string): Promise<{ code: string }> {
    const raw = await this.redis.get(this.key(nonce));
    if (!raw) throw new NotFoundException('Kirish so‘rovi topilmadi yoki eskirgan');

    const customer = await this.customers.findOne({ where: { telegramId } });
    // Mijoz hali telefon raqamini bermagan bo'lsa — bot avval ro'yxatdan
    // o'tkazadi va shundan keyin qayta chaqiradi.
    if (!customer) throw new NotFoundException('Mijoz topilmadi — avval ro‘yxatdan o‘ting');
    if (customer.isBlocked) throw new ForbiddenException('Hisobingiz bloklangan');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // TTL SAQLANADI: `set` ni `EX` siz yozsak nonce abadiy qolib ketardi.
    const ttl = await this.redis.ttl(this.key(nonce));
    await this.redis.set(
      this.key(nonce),
      JSON.stringify({ status: 'confirmed', customerId: customer.id, code, attempts: 0 }),
      'EX',
      ttl > 0 ? ttl : CustomerAuthService.TTL_SEC,
    );

    this.log.log(`Mijoz kirishi tasdiqlandi: ${customer.id}`);
    return { code };
  }

  /**
   * 3-qadam: ilova tasdiqni kutadi.
   *
   * TOKEN BERMAYDI — faqat "bot tasdiqladimi" degan holat. Token uchun kod
   * kiritilishi shart (`verify`), chunki tasdiqlovchi va ilovani ushlab
   * turgan odam boshqa-boshqa bo'lishi mumkin (qarang: klass izohi).
   */
  async poll(nonce: string): Promise<{ confirmed: boolean }> {
    const raw = await this.redis.get(this.key(nonce));
    if (!raw) throw new NotFoundException('Kirish so‘rovi topilmadi yoki eskirgan');
    const state = JSON.parse(raw) as { status: string; customerId?: string };
    return { confirmed: state.status === 'confirmed' && !!state.customerId };
  }

  /** 4-qadam: foydalanuvchi bot chatidagi kodni ilovaga kiritdi. */
  async verify(nonce: string, code: string): Promise<{ token: string }> {
    const raw = await this.redis.get(this.key(nonce));
    if (!raw) throw new NotFoundException('Kirish so‘rovi topilmadi yoki eskirgan');
    const state = JSON.parse(raw) as {
      status: string;
      customerId?: string;
      code?: string;
      attempts: number;
    };
    if (state.status !== 'confirmed' || !state.customerId || !state.code) {
      throw new BadRequestException('Kirish hali tasdiqlanmagan');
    }

    if (!this.sameCode(state.code, code)) {
      const attempts = (state.attempts ?? 0) + 1;
      if (attempts >= CustomerAuthService.MAX_ATTEMPTS) {
        // Nonce o'ldiriladi — qolgan kodlarni tanlab bo'lmasin.
        await this.redis.del(this.key(nonce));
        throw new ForbiddenException('Juda ko‘p xato urinish — qaytadan boshlang');
      }
      const ttl = await this.redis.ttl(this.key(nonce));
      await this.redis.set(
        this.key(nonce),
        JSON.stringify({ ...state, attempts }),
        'EX',
        ttl > 0 ? ttl : CustomerAuthService.TTL_SEC,
      );
      throw new BadRequestException('Kod noto‘g‘ri');
    }

    await this.redis.del(this.key(nonce));
    return { token: await this.sign(state.customerId) };
  }

  /** Vaqt bo'yicha oqib chiqmaydigan solishtirish. */
  private sameCode(expected: string, got: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(got ?? ''));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private sign(customerId: string): Promise<string> {
    const payload: JwtPayload = { sub: customerId, role: 'customer' };
    return this.jwt.signAsync(payload);
  }

  private async rateLimitStart(deviceId?: string): Promise<void> {
    if (!deviceId) return;
    const key = `auth:start:${deviceId}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 60);
    if (n > CustomerAuthService.MAX_STARTS_PER_MIN) {
      throw new BadRequestException('Juda tez-tez urinmoqdasiz. Bir daqiqa kuting.');
    }
  }
}
