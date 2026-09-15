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
import { In, MoreThan, Repository } from 'typeorm';
import Redis from 'ioredis';
import { OrderStatus, VehicleCategory, ActorType } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { DriversService } from '../drivers/drivers.service';
import { OrdersService } from '../orders/orders.service';
import { ReputationService } from '../reputation/reputation.service';
import { TripsService } from '../trips/trips.service';
import { SettingsService } from '../settings/settings.service';
import { COMFORT_SUGGEST_AFTER_SEC, canSuggestStandard, standardSuggestAt } from '../dispatch/dispatch.util';
import {
  ACTIVE_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  NO_DRIVER_PENDING_MS,
  TERMINAL_STATUSES,
} from '../orders/orders.constants';

/**
 * Mijozning zakaz bilan bog'liq AMALLARI — kim so'ragani ALLAQACHON aniqlangan.
 *
 * NEGA ALOHIDA: mijoz tizimga UCH xil yo'ldan kiradi —
 *   - Telegram Mini App → `initData` imzosi
 *   - mijoz ilovasi     → JWT (`role: 'customer'`)
 *   - bot               → ichki kalit
 * Har biriga alohida mantiq yozilsa, bir kuni biri yangilanmay qoladi. Bu
 * allaqachon ikki marta sodir bo'lgan: mini app'da baholash bor edi, botda
 * yo'q; botda bekor qilish bor edi, mini app'da yo'q.
 *
 * Shuning uchun: MANTIQ shu yerda, `customerId` bilan. Controller/servis
 * faqat "kim so'rayapti" ni aniqlaydi va shu metodlarni chaqiradi.
 */
@Injectable()
export class CustomerOrdersService {
  private readonly log = new Logger(CustomerOrdersService.name);

  /** Bir daqiqada nechta buyurtma (yarat/bekor qil tsikliga qarshi). */
  private static readonly MAX_ORDERS_PER_MIN = 5;

  /** Bot shu kanalni tinglaydi va zakazni Telegram'da kuzatishni boshlaydi. */
  static readonly BOT_TRACK_CHANNEL = 'bot:track';

  private static readonly FINISHED: OrderStatus[] = [
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED_BY_CUSTOMER,
    OrderStatus.CANCELLED_BY_DRIVER,
    OrderStatus.CUSTOMER_NO_SHOW,
    OrderStatus.CLOSED_BY_OPERATOR,
  ];

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly drivers: DriversService,
    private readonly ordersService: OrdersService,
    private readonly reputation: ReputationService,
    private readonly trips: TripsService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Toifalar bazaviy narxi bilan — tanlash oynasida "...dan boshlab" uchun.
   * Km oldindan noma'lum (borish joyi tanlanmaydi), shuning uchun yakuniy
   * narx EMAS, faqat admin panelda sozlangan bazaviy narx ko'rsatiladi.
   */
  async tariffs(): Promise<{ category: VehicleCategory; baseFare: number; perKm: number }[]> {
    const rows = await this.settings.listTariffs();
    // NARX BO'YICHA saralanadi — maketda kartalar arzondan qimmatga qarab
    // turadi va bu tartib admin tarifni o'zgartirgach ham buzilmasligi kerak.
    return rows
      .map((t) => ({ category: t.category, baseFare: t.baseFare, perKm: t.perKm }))
      .sort((a, b) => a.baseFare - b.baseFare);
  }

  /**
   * Tugagan buyurtmalar tarixi — VAQT bo'yicha, eng yangisi birinchi.
   *
   * `COALESCE(completed_at, created_at)` ishlatiladi — `DriversService.tripHistory`
   * dagi bilan bir xil sabab: Postgres `DESC`da NULL'ni BIRINCHI qo'yadi, bekor
   * qilingan buyurtmalarda `completed_at` bo'sh, ular ro'yxat boshini egallab
   * qolardi.
   */
  async history(customerId: string): Promise<HistoryItem[]> {
    const rows = await this.orders
      .createQueryBuilder('o')
      .where('o.customer_id = :customerId AND o.status IN (:...st)', {
        customerId,
        st: TERMINAL_STATUSES,
      })
      .orderBy('COALESCE(o.completed_at, o.created_at)', 'DESC')
      .take(50)
      .getMany();

    return rows.map((o) => ({
      orderId: o.id,
      category: o.vehicleCategory,
      status: o.status,
      finalPrice: o.finalPrice,
      at: (o.completedAt ?? o.createdAt).toISOString(),
    }));
  }

  /** Zakaz shu mijozniki ekanini tekshirib qaytaradi. */
  private async mustOwn(customerId: string, orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.customerId !== customerId) {
      throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
    }
    return order;
  }

  /**
   * Mijozning hozirgi faol buyurtmasi (bo'lsa) — ilova va mini app qayta
   * ochilganda shu bilan kuzatuvga qaytadi.
   *
   * "Taksi topilmadi" (NO_DRIVER) ham qaytariladi, agar u hali qayta
   * ko'tarilishi mumkin bo'lsa (`NO_DRIVER_PENDING_MS`). 2026-09-15: qaytarilmasdi
   * — mijoz qayta ochib bo'sh buyurtma ekranini ko'rdi va zakaz bekor bo'ldi deb
   * o'yladi, haydovchi esa keyin onlayn bo'lib o'sha zakazni qabul qildi.
   */
  async activeOrderId(customerId: string): Promise<{ orderId: string | null }> {
    const order = await this.orders.findOne({
      where: [
        { customerId, status: In(ACTIVE_STATUSES) },
        {
          customerId,
          status: OrderStatus.NO_DRIVER,
          createdAt: MoreThan(new Date(Date.now() - NO_DRIVER_PENDING_MS)),
        },
      ],
      order: { createdAt: 'DESC' },
    });
    return { orderId: order?.id ?? null };
  }

  /**
   * Xaritadan tanlangan nuqta bilan buyurtma berish.
   *
   * Barcha qoidalar `OrdersService.create()` da qoladi (bitta faol buyurtma,
   * bloklangan mijoz, dispatch'ni ishga tushirish).
   */
  async createOrder(
    customerId: string,
    category: VehicleCategory,
    pickup: { lat: number; lng: number },
    passengers?: number,
  ): Promise<{ orderId: string }> {
    await this.rateLimit(customerId);
    const order = await this.ordersService.create({ customerId, category, pickup, passengers });

    // Botga xabar beramiz — busiz ilovadan/mini app'dan berilgan zakaz uchun
    // mijoz Telegram'da HECH QANDAY xabar olmasdi.
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (customer?.telegramId) {
      await this.redis
        .publish(
          CustomerOrdersService.BOT_TRACK_CHANNEL,
          JSON.stringify({ telegramId: String(customer.telegramId), orderId: order.id }),
        )
        .catch((e) => this.log.error(`Botga xabar berib bo'lmadi: ${(e as Error).message}`));
    }
    this.log.log(`Mijoz buyurtmasi: ${order.id} (mijoz ${customerId})`);
    return { orderId: order.id };
  }

  /** Kuzatuv ma'lumoti (jonli xarita, haydovchi kartasi, yakun). */
  async track(customerId: string, orderId: string): Promise<TrackView> {
    const order = await this.mustOwn(customerId, orderId);

    const loc = order.driverId ? await this.drivers.lastLocation(order.driverId) : null;
    const info = order.driverId ? await this.drivers.findWithVehicle(order.driverId) : null;

    return {
      orderId: order.id,
      orderStatus: order.status,
      pickup: { lat: order.pickupLat, lng: order.pickupLng },
      dest:
        order.destLat != null && order.destLng != null
          ? { lat: order.destLat, lng: order.destLng }
          : null,
      driver: loc ? { lat: loc.lat, lng: loc.lng, at: loc.at ? loc.at.toISOString() : null } : null,
      car: info
        ? {
            name:
              [info.driver.firstName, info.driver.lastName].filter(Boolean).join(' ') || 'Haydovchi',
            plate: info.vehicle?.plate ?? '',
            model: [info.vehicle?.color, info.vehicle?.make, info.vehicle?.model]
              .filter(Boolean)
              .join(' '),
            phone: info.driver.phone,
            rating: info.driver.ratingAvg,
          }
        : null,
      finished: CustomerOrdersService.FINISHED.includes(order.status),
      finalPrice: order.finalPrice,
      fareAdjustment: Number(order.fareAdjustment) || 0,
      fareAdjustmentReason: order.fareAdjustmentReason,
      completed: order.status === OrderStatus.COMPLETED,
      rated:
        order.status === OrderStatus.COMPLETED
          ? await this.reputation.hasRated(order.id, 'customer_to_driver')
          : false,
      cancellable: CUSTOMER_CANCELLABLE_STATUSES.includes(order.status),
      category: order.vehicleCategory,
      canSwitchToStandard: canSuggestStandard(order, new Date(), this.suggestAfterSec()),
      standardSuggestAt: standardSuggestAt(order, this.suggestAfterSec())?.toISOString() ?? null,
    };
  }

  /** Comfort qidiruvidan necha soniya keyin Standart taklif qilinadi (`COMFORT_SUGGEST_AFTER_SEC`). */
  private suggestAfterSec(): number {
    const raw = this.config.get<string>('COMFORT_SUGGEST_AFTER_SEC');
    const v = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : COMFORT_SUGGEST_AFTER_SEC;
  }

  /**
   * Comfort topilmayapti — mijoz roziligi bilan Standart'ga o'tkazib qayta
   * qidirish. Qidiruv hali ketayotgan bo'lsa ham mumkin (Comfort takliflari
   * qaytarib olinadi).
   */
  async switchToStandard(customerId: string, orderId: string) {
    await this.mustOwn(customerId, orderId);
    return this.ordersService.switchToStandard(orderId, ActorType.CUSTOMER, customerId);
  }

  async cancel(customerId: string, orderId: string): Promise<{ penalized: boolean }> {
    await this.mustOwn(customerId, orderId);
    const res = await this.trips.cancelByCustomer(orderId, 'customer');
    this.log.log(`Mijoz bekor qildi: ${orderId} (mijoz ${customerId})`);
    return res;
  }

  /**
   * Haydovchini baholash. Kategoriyalar bot bilan BIR XIL — aks holda bitta
   * haydovchining reytingi qaysi oynadan baholanganiga qarab boshqacha
   * hisoblanardi.
   */
  async rate(
    customerId: string,
    orderId: string,
    score: number,
    comment?: string,
  ): Promise<{ ok: true }> {
    const order = await this.mustOwn(customerId, orderId);
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Safar yakunlanmagan');
    }
    // Takroriy baho `ReputationService.submit` da jimgina e'tiborsiz qoldiriladi.
    await this.reputation.submit(
      orderId,
      'customer_to_driver',
      { manners: score, driving: score, car_condition: score, punctuality: score },
      comment,
    );
    return { ok: true };
  }

  private async rateLimit(customerId: string): Promise<void> {
    const key = `customer:order:${customerId}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 60);
    if (n > CustomerOrdersService.MAX_ORDERS_PER_MIN) {
      throw new BadRequestException('Juda tez-tez buyurtma bermoqdasiz. Bir daqiqa kuting.');
    }
  }
}

export interface TrackView {
  orderId: string;
  orderStatus: OrderStatus;
  pickup: { lat: number; lng: number };
  dest: { lat: number; lng: number } | null;
  driver: { lat: number; lng: number; at: string | null } | null;
  car: { name: string; plate: string; model: string; phone: string; rating: number } | null;
  /** Safar tugadi — sahifa so'rovlarni to'xtatsin. */
  finished: boolean;
  /** Yakuniy narx — faqat COMPLETED bo'lganda to'ladi. */
  finalPrice: number | null;
  /**
   * Operator qo'shgan summa va sababi — hisobda ALOHIDA qator.
   *
   * Yakuniy narxga allaqachon kirgan, lekin jimgina kirsa mijoz "nega
   * bunchalik ko'p?" deb qolardi. Sabab ko'rinib tursa savol tug'ilmaydi.
   */
  fareAdjustment: number;
  fareAdjustmentReason: string | null;
  /** Muvaffaqiyatli yakunlandimi (bekor qilish emas) — baholash shunda so'raladi. */
  completed: boolean;
  /** Mijoz allaqachon baholaganmi (bot chatidan ham bo'lishi mumkin). */
  rated: boolean;
  /** Hozir bekor qilsa bo'ladimi. */
  cancellable: boolean;
  /** Mijoz TANLAGAN toifa. */
  category: VehicleCategory;
  /**
   * Comfort topilmadi — "Standartga o'tkazish" tugmasini ko'rsatish.
   * Qoida serverda: ilova, mini app va bot bir xil hisoblaydi, biri
   * yangilanmay qolib ishlamaydigan tugma chiqarmasin.
   */
  canSwitchToStandard: boolean;
  /**
   * Taklif qachon chiqadi (ISO). Klient shu vaqtda holatni qayta so'raydi —
   * Comfort qidiruvi davomida holat o'zgarmaydi va soket hodisa yubormaydi,
   * aks holda tugma keyingi zaxira so'rovgacha (30 s) kechikardi.
   */
  standardSuggestAt: string | null;
}

export interface HistoryItem {
  orderId: string;
  category: VehicleCategory;
  status: OrderStatus;
  finalPrice: number | null;
  /** ISO vaqt — `completedAt ?? createdAt` (bekor qilinganlarda `completedAt` bo'sh). */
  at: string;
}
