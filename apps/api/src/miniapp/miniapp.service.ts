import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { OrderStatus, VehicleCategory } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { DriversService } from '../drivers/drivers.service';
import { OrdersService } from '../orders/orders.service';
import { ACTIVE_STATUSES } from '../orders/orders.constants';
import { verifyInitData } from './telegram-init-data';

export interface TrackView {
  orderId: string;
  orderStatus: OrderStatus;
  pickup: { lat: number; lng: number };
  dest: { lat: number; lng: number } | null;
  driver: { lat: number; lng: number; at: string | null } | null;
  car: { name: string; plate: string; model: string; phone: string } | null;
  /** Safar tugadi — sahifa so'rovlarni to'xtatsin. */
  finished: boolean;
}

// Bir daqiqada nechta buyurtma yaratishga ruxsat (yarat/bekor qil tsikliga qarshi).
const MAX_ORDERS_PER_MIN = 5;

const FINISHED: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED_BY_CUSTOMER,
  OrderStatus.CANCELLED_BY_DRIVER,
  OrderStatus.CUSTOMER_NO_SHOW,
  OrderStatus.CLOSED_BY_OPERATOR,
];

@Injectable()
export class MiniappService {
  private readonly log = new Logger(MiniappService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly drivers: DriversService,
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
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
   * Mijozning hozirgi faol buyurtmasi (bo'lsa). Mini app ochilganda qaysi
   * rejimda ishlashini shu hal qiladi: kuzatuv yoki yangi buyurtma.
   */
  async activeOrderId(initData: string): Promise<{ orderId: string | null }> {
    const customer = await this.requireCustomer(initData);
    const order = await this.orders.findOne({
      where: { customerId: customer.id, status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
    });
    return { orderId: order?.id ?? null };
  }

  /**
   * Mini app'dan buyurtma berish (xaritadan tanlangan nuqta bilan).
   *
   * Bot oqimidan farqi: nuqta telefonning JORIY GPS'i bilan cheklanmaydi —
   * mijoz xaritadan istalgan joyni ko'rsata oladi (boshqa manzil, ko'cha
   * burchagi, bino GPS'i noto'g'ri bo'lgan holat).
   *
   * Barcha qoidalar `OrdersService.create()` da qoladi (bitta faol buyurtma,
   * bloklangan mijoz, dispatch'ni ishga tushirish) — bu yerda faqat kim
   * so'rayotgani tekshiriladi.
   */
  async createOrder(
    initData: string,
    category: VehicleCategory,
    pickup: { lat: number; lng: number },
  ): Promise<{ orderId: string }> {
    const customer = await this.requireCustomer(initData);
    await this.rateLimit(customer.id);
    const order = await this.ordersService.create({
      customerId: customer.id,
      category,
      pickup,
    });
    this.log.log(`Mini app'dan buyurtma: ${order.id} (mijoz ${customer.id})`);
    return { orderId: order.id };
  }

  /**
   * Buyurtma berish tezligini cheklaymiz. `OrdersService` allaqachon bitta faol
   * buyurtmaga ruxsat beradi, lekin "yarat → bekor qil" tsikli bilan dispatch'ni
   * yuklash mumkin edi.
   */
  private async rateLimit(customerId: string): Promise<void> {
    const key = `miniapp:order:${customerId}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 60);
    if (n > MAX_ORDERS_PER_MIN) {
      throw new BadRequestException('Juda tez-tez buyurtma bermoqdasiz. Bir daqiqa kuting.');
    }
  }

  /**
   * Kuzatuv ma'lumoti. Zakaz AYNAN shu foydalanuvchiniki ekani tekshiriladi.
   */
  async track(initData: string, orderId: string): Promise<TrackView> {
    const customer = await this.requireCustomer(initData);

    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customer.id) {
      throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
    }

    const loc = order.driverId ? await this.drivers.lastLocation(order.driverId) : null;
    const info = order.driverId ? await this.drivers.findWithVehicle(order.driverId) : null;

    return {
      orderId: order.id,
      orderStatus: order.status,
      pickup: { lat: order.pickupLat, lng: order.pickupLng },
      dest: order.destLat != null && order.destLng != null
        ? { lat: order.destLat, lng: order.destLng }
        : null,
      driver: loc ? { lat: loc.lat, lng: loc.lng, at: loc.at ? loc.at.toISOString() : null } : null,
      car: info
        ? {
            name: [info.driver.firstName, info.driver.lastName].filter(Boolean).join(' ') || 'Haydovchi',
            plate: info.vehicle?.plate ?? '',
            model: [info.vehicle?.color, info.vehicle?.make, info.vehicle?.model]
              .filter(Boolean)
              .join(' '),
            phone: info.driver.phone,
          }
        : null,
      finished: FINISHED.includes(order.status),
    };
  }
}
