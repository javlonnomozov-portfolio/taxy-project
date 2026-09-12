import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleCategory } from '@tty/shared';
import { Customer } from '../entities/customer.entity';
import { CustomerOrdersService, TrackView } from '../customers/customer-orders.service';
import { CustomersService } from '../customers/customers.service';
import { verifyInitData } from './telegram-init-data';

export type { TrackView } from '../customers/customer-orders.service';

/** Mini appdagi "Profil" ekrani ko'rsatadigan maydonlar. */
export interface ProfileView {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  language: string;
}

/** Bot shu kanalni tinglaydi (mavjud importlar buzilmasin uchun qoldirilgan). */
export const BOT_TRACK_CHANNEL = CustomerOrdersService.BOT_TRACK_CHANNEL;

@Injectable()
export class MiniappService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly config: ConfigService,
    private readonly shared: CustomerOrdersService,
    private readonly people: CustomersService,
  ) {}

  /**
   * Mini appdagi "Profil" ekrani.
   *
   * `/customer/profile` JWT talab qiladi, mini app esa `initData` bilan
   * ishlaydi — shuning uchun o'sha mantiq shu yerda ochiladi. Yozish
   * `CustomersService.updateProfile` ga tushadi (telefonni u normallashtiradi),
   * ya'ni qoidalar ikkala kanalda BIR XIL.
   */
  async profile(initData: string): Promise<ProfileView> {
    return MiniappService.profileView(await this.requireCustomer(initData));
  }

  async saveProfile(
    initData: string,
    patch: { firstName?: string; lastName?: string; phone?: string; language?: string },
  ): Promise<ProfileView> {
    const customer = await this.requireCustomer(initData);
    await this.people.updateProfile(customer.id, patch);
    const fresh = await this.people.findById(customer.id);
    return MiniappService.profileView(fresh ?? customer);
  }

  private static profileView(c: Customer): ProfileView {
    return {
      firstName: c.firstName ?? null,
      lastName: c.lastName ?? null,
      phone: c.phone ?? null,
      language: c.language ?? 'uz',
    };
  }

  get enabled(): boolean {
    return !!this.config.get<string>('TELEGRAM_BOT_TOKEN');
  }

  /**
   * Imzoni tekshirib, so'rov EGASI bo'lgan mijozni qaytaradi.
   * Har bir mini app amali shu yerdan boshlanadi — busiz begona odam
   * `?order=<id>` bilan boshqa safarni ko'rishi/buyurtma berishi mumkin bo'lardi.
   */
  private async requireCustomer(initData: string): Promise<Customer> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new ServiceUnavailableException('Mini app sozlanmagan');

    const tgUser = verifyInitData(initData, token);
    if (!tgUser) throw new ForbiddenException('Imzo tekshiruvidan o‘tmadi');

    // `telegram_id` — bigint, TypeORM uni string qaytaradi; taqqoslash string bo'yicha.
    const customer = await this.customers.findOne({ where: { telegramId: tgUser.id } });
    if (!customer) {
      throw new ForbiddenException('Avval botda ro‘yxatdan o‘ting (telefon raqamingiz kerak)');
    }
    if (customer.isBlocked) throw new ForbiddenException('Hisobingiz bloklangan');
    return customer;
  }

  /**
   * Mini App amallari — hammasi `CustomerOrdersService` ga UZATILADI.
   *
   * Bu yerda faqat "kim so'rayapti" aniqlanadi (`initData` imzosi), amalning
   * O'ZI umumiy servisda. Avval mantiq shu faylda edi va mijoz ilovasi
   * qo'shilganda u ikkinchi nusxaga bo'linib ketardi — o'sha naqsh allaqachon
   * ikki marta xato keltirgan (baholash va bekor qilish bir oynada bor,
   * ikkinchisida yo'q edi).
   */
  /**
   * Sahifa ochilganda kerak bo'ladigan HAMMASI bitta so'rovda: faol buyurtma
   * bormi va toifalarning boshlang'ich narxi qancha.
   *
   * Narx maketda toifa kartasida turadi ("3 000 so'mdan"). Uni alohida
   * so'rov bilan olish sahifa ochilishini ikki marta kutishga majburlardi.
   */
  async activeOrderId(
    initData: string,
  ): Promise<{ orderId: string | null; tariffs: { category: string; baseFare: number }[] }> {
    const customer = await this.requireCustomer(initData);
    const [active, tariffs] = await Promise.all([
      this.shared.activeOrderId(customer.id),
      this.shared.tariffs(),
    ]);
    return {
      ...active,
      tariffs: tariffs.map((t) => ({ category: t.category, baseFare: t.baseFare })),
    };
  }

  async createOrder(
    initData: string,
    category: VehicleCategory,
    pickup: { lat: number; lng: number },
    passengers?: number,
  ): Promise<{ orderId: string }> {
    const customer = await this.requireCustomer(initData);
    return this.shared.createOrder(customer.id, category, pickup, passengers);
  }

  async track(initData: string, orderId: string): Promise<TrackView> {
    const customer = await this.requireCustomer(initData);
    return this.shared.track(customer.id, orderId);
  }

  async cancel(initData: string, orderId: string): Promise<{ penalized: boolean }> {
    const customer = await this.requireCustomer(initData);
    return this.shared.cancel(customer.id, orderId);
  }

  async rate(initData: string, orderId: string, score: number): Promise<{ ok: true }> {
    const customer = await this.requireCustomer(initData);
    return this.shared.rate(customer.id, orderId, score);
  }
}
