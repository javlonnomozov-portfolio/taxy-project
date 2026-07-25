import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActorType, OrderStatus, OrderType, VehicleCategory } from '@tty/shared';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { OrderEventsService } from './order-events.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { DriversService } from '../drivers/drivers.service';
import { ACTIVE_STATUSES } from './orders.constants';

export interface CreateOrderInput {
  customerId: string;
  category: VehicleCategory;
  pickup: { lat: number; lng: number };
  pickupAddress?: string;
  destination?: { lat: number; lng: number };
  destAddress?: string;
  note?: string;
  orderType?: OrderType;
  scheduledAt?: string; // ISO — oldindan buyurtma uchun
}

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly events: OrderEventsService,
    private readonly dispatch: DispatchService,
    private readonly drivers: DriversService,
  ) {}

  async create(input: CreateOrderInput): Promise<Order> {
    const customer = await this.customers.findOne({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    if (customer.isBlocked) throw new BadRequestException('Mijoz bloklangan');

    // Bir vaqtda bitta faol buyurtma (2.14).
    const active = await this.orders.findOne({
      where: { customerId: input.customerId, status: In(ACTIVE_STATUSES) },
    });
    if (active) throw new ConflictException('Sizda allaqachon faol buyurtma bor');

    const isScheduled = input.orderType === OrderType.SCHEDULED && !!input.scheduledAt;
    const order = this.orders.create({
      customerId: input.customerId,
      orderType: input.orderType ?? OrderType.STANDARD,
      status: OrderStatus.CREATED,
      vehicleCategory: input.category,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      pickupAddress: input.pickupAddress ?? null,
      destLat: input.destination?.lat ?? null,
      destLng: input.destination?.lng ?? null,
      destAddress: input.destAddress ?? null,
      note: input.note ?? null,
      scheduledAt: isScheduled ? new Date(input.scheduledAt!) : null,
    });
    await this.orders.save(order);
    await this.events.record(order.id, 'created', ActorType.CUSTOMER, {
      actorId: customer.id,
      payload: isScheduled ? { scheduledAt: input.scheduledAt } : undefined,
    });

    // Oldindan buyurtma: darhol dispatch qilinmaydi — operator ~2 soat oldin tasdiqlaydi (2.12).
    // Standart zakaz: dispatch'ni biroz kechiktiramiz — shunda create() javob qaytaradi,
    // bot mijoz kuzatuv socketiga ulanadi, va sinxron NO_DRIVER eventi yo'qolmaydi (poyga sharti).
    if (!isScheduled) {
      setTimeout(() => {
        this.dispatch
          .start(order.id)
          .catch((e) => this.log.error(`Dispatch start xato (${order.id}): ${(e as Error).message}`));
      }, 500);
    }
    return order;
  }

  findById(id: string): Promise<Order | null> {
    return this.orders.findOne({ where: { id } });
  }

  /**
   * Biriktirilgan taksining hozirgi holati va oxirgi ma'lum joylashuvi
   * (mijozga bot orqali ko'rsatish uchun). Haydovchi biriktirilmagan bo'lsa null.
   */
  async driverLocation(orderId: string): Promise<{
    orderStatus: OrderStatus;
    driverStatus: string;
    lat: number;
    lng: number;
    at: string | null;
  } | null> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (!order.driverId) return null;
    const loc = await this.drivers.lastLocation(order.driverId);
    if (!loc) return null;
    return {
      orderStatus: order.status,
      driverStatus: loc.status,
      lat: loc.lat,
      lng: loc.lng,
      at: loc.at ? loc.at.toISOString() : null,
    };
  }
}
