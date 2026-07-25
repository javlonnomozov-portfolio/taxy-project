import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActorType, OrderStatus, OrderType, VehicleCategory } from '@tty/shared';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { OrderEventsService } from './order-events.service';
import { DispatchService } from '../dispatch/dispatch.service';
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
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly events: OrderEventsService,
    private readonly dispatch: DispatchService,
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
      pickupPoint: { type: 'Point', coordinates: [input.pickup.lng, input.pickup.lat] },
      pickupAddress: input.pickupAddress ?? null,
      destPoint: input.destination
        ? { type: 'Point', coordinates: [input.destination.lng, input.destination.lat] }
        : null,
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
    if (!isScheduled) {
      await this.dispatch.start(order.id);
    }
    return order;
  }

  findById(id: string): Promise<Order | null> {
    return this.orders.findOne({ where: { id } });
  }
}
