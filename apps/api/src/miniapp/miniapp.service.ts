import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '@tty/shared';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { DriversService } from '../drivers/drivers.service';
import { verifyInitData } from './telegram-init-data';

export interface TrackView {
  orderStatus: OrderStatus;
  pickup: { lat: number; lng: number };
  dest: { lat: number; lng: number } | null;
  driver: { lat: number; lng: number; at: string | null } | null;
  car: { name: string; plate: string; model: string; phone: string } | null;
  /** Safar tugadi — sahifa so'rovlarni to'xtatsin. */
  finished: boolean;
}

const FINISHED: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED_BY_CUSTOMER,
  OrderStatus.CANCELLED_BY_DRIVER,
  OrderStatus.CUSTOMER_NO_SHOW,
  OrderStatus.CLOSED_BY_OPERATOR,
];

@Injectable()
export class MiniappService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly drivers: DriversService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return !!this.config.get<string>('TELEGRAM_BOT_TOKEN');
  }

  /**
   * Mini app so'rovi: Telegram imzosini tekshiramiz va zakaz AYNAN shu
   * foydalanuvchiniki ekaniga ishonch hosil qilamiz. Busiz `?order=<id>` bilan
   * begona safarni jonli kuzatish mumkin bo'lardi.
   */
  async track(initData: string, orderId: string): Promise<TrackView> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new ServiceUnavailableException('Mini app sozlanmagan');

    const tgUser = verifyInitData(initData, token);
    if (!tgUser) throw new ForbiddenException('Imzo tekshiruvidan o‘tmadi');

    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');

    const customer = await this.customers.findOne({ where: { id: order.customerId } });
    // `telegram_id` — bigint, TypeORM uni string qaytaradi; taqqoslash ham string bo'yicha.
    if (!customer || String(customer.telegramId ?? '') !== tgUser.id) {
      throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
    }

    const loc = order.driverId ? await this.drivers.lastLocation(order.driverId) : null;
    const info = order.driverId ? await this.drivers.findWithVehicle(order.driverId) : null;

    return {
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
