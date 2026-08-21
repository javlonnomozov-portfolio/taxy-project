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
import { verifyInitData } from './telegram-init-data';

export type { TrackView } from '../customers/customer-orders.service';

/** Bot shu kanalni tinglaydi (mavjud importlar buzilmasin uchun qoldirilgan). */
export const BOT_TRACK_CHANNEL = CustomerOrdersService.BOT_TRACK_CHANNEL;

@Injectable()
export class MiniappService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly config: ConfigService,
    private readonly shared: CustomerOrdersService,
  ) {}

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
  async activeOrderId(initData: string): Promise<{ orderId: string | null }> {
    const customer = await this.requireCustomer(initData);
    return this.shared.activeOrderId(customer.id);
  }

  async createOrder(
    initData: string,
    category: VehicleCategory,
    pickup: { lat: number; lng: number },
  ): Promise<{ orderId: string }> {
    const customer = await this.requireCustomer(initData);
    return this.shared.createOrder(customer.id, category, pickup);
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
