import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ActorType, OrderStatus, SOCKET_EVENTS } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { TripTrack, TrackPoint } from '../entities/trip-track.entity';
import { SosEvent } from '../entities/sos-event.entity';
import { OrderEventsService } from '../orders/order-events.service';
import { DriversService } from '../drivers/drivers.service';
import { PricingService } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { BillingService } from '../billing/billing.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class TripsService {
  private readonly log = new Logger(TripsService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(TripTrack) private readonly tracks: Repository<TripTrack>,
    @InjectRepository(SosEvent) private readonly sosRepo: Repository<SosEvent>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly events: OrderEventsService,
    private readonly drivers: DriversService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly billing: BillingService,
    private readonly realtime: RealtimeService,
  ) {}

  private async mustOwn(orderId: string, driverId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.driverId !== driverId) throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
    return order;
  }

  private async transition(
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    extra: Partial<Order> = {},
  ): Promise<boolean> {
    const res = await this.orders
      .createQueryBuilder()
      .update(Order)
      .set({ status: to, ...extra })
      .where('id = :id AND status = :from', { id: orderId, from })
      .execute();
    return !!res.affected;
  }

  private notify(order: Order, status: OrderStatus, extra: Record<string, unknown> = {}): void {
    this.realtime.emitToCustomer(order.customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId: order.id,
      status,
      ...extra,
    });
    this.realtime.emitToOps(SOCKET_EVENTS.ops.orderUpdate, {
      orderId: order.id,
      status,
      driverId: order.driverId,
    });
  }

  // ---- Safar bosqichlari (haydovchi) ----

  async confirm(orderId: string, driverId: string): Promise<void> {
    const order = await this.mustOwn(orderId, driverId);
    if (!(await this.transition(orderId, OrderStatus.ACCEPTED, OrderStatus.CONFIRMED))) {
      throw new BadRequestException('Holat ACCEPTED emas');
    }
    await this.events.record(orderId, 'confirmed', ActorType.DRIVER, { actorId: driverId });
    this.notify(order, OrderStatus.CONFIRMED);
  }

  async arrived(orderId: string, driverId: string): Promise<void> {
    const order = await this.mustOwn(orderId, driverId);
    // confirm — yumshoq qadam; ACCEPTED'dan ham to'g'ridan yetib kelish mumkin.
    const ok =
      (await this.transition(orderId, OrderStatus.CONFIRMED, OrderStatus.ARRIVED)) ||
      (await this.transition(orderId, OrderStatus.ARRIVING, OrderStatus.ARRIVED)) ||
      (await this.transition(orderId, OrderStatus.ACCEPTED, OrderStatus.ARRIVED));
    if (!ok) throw new BadRequestException('Holat ARRIVED ga o‘tmadi');
    await this.redis.set(`order:arrived:${orderId}`, new Date().toISOString(), 'EX', 7200);
    await this.events.record(orderId, 'arrived', ActorType.DRIVER, { actorId: driverId });
    this.notify(order, OrderStatus.ARRIVED);
  }

  private async waitingMinutes(orderId: string): Promise<number> {
    const iso = await this.redis.get(`order:arrived:${orderId}`);
    if (!iso) return 0;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  }

  async start(orderId: string, driverId: string): Promise<void> {
    const order = await this.mustOwn(orderId, driverId);
    const waiting = await this.waitingMinutes(orderId);
    if (
      !(await this.transition(orderId, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS, {
        startedAt: new Date(),
        waitingMinutes: waiting,
      }))
    ) {
      throw new BadRequestException('Holat ARRIVED emas');
    }
    await this.events.record(orderId, 'started', ActorType.DRIVER, {
      actorId: driverId,
      payload: { waitingMinutes: waiting },
    });
    this.notify(order, OrderStatus.IN_PROGRESS);
  }

  async complete(
    orderId: string,
    driverId: string,
    distanceM: number,
  ): Promise<{ finalPrice: number; commission: number }> {
    const order = await this.mustOwn(orderId, driverId);
    if (order.status !== OrderStatus.IN_PROGRESS) throw new BadRequestException('Holat IN_PROGRESS emas');

    const fare = await this.pricing.computeFare(
      order.vehicleCategory,
      distanceM,
      order.waitingMinutes,
      new Date(),
    );
    const commission = await this.billing.applyCommission(driverId, fare.total, orderId);
    await this.transition(orderId, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED, {
      distanceM,
      finalPrice: fare.total,
      commissionAmount: commission,
      surgeMultiplier: fare.surgeMultiplier,
      nightMultiplier: fare.nightMultiplier,
      completedAt: new Date(),
    });
    await this.drivers.markIdle(driverId);
    await this.redis.del(`order:arrived:${orderId}`);
    await this.events.record(orderId, 'completed', ActorType.DRIVER, {
      actorId: driverId,
      payload: { ...fare, distanceM, commission },
    });
    order.status = OrderStatus.COMPLETED;
    this.notify(order, OrderStatus.COMPLETED, { finalPrice: fare.total, breakdown: fare });
    this.log.log(`Buyurtma ${orderId} yakunlandi — narx ${fare.total} so'm (komissiya ${commission})`);
    return { finalPrice: fare.total, commission };
  }

  async noShow(orderId: string, driverId: string): Promise<{ waitingFee: number }> {
    const order = await this.mustOwn(orderId, driverId);
    if (order.status !== OrderStatus.ARRIVED) throw new BadRequestException('Holat ARRIVED emas');

    const waiting = await this.waitingMinutes(orderId);
    const tariff = await this.settings.getTariff(order.vehicleCategory);
    const billableWait = Math.max(0, waiting - (tariff?.freeWaitMin ?? 0));
    const waitingFee = Math.round(billableWait * Number(tariff?.waitingPerMin ?? 0));

    await this.transition(orderId, OrderStatus.ARRIVED, OrderStatus.CUSTOMER_NO_SHOW, {
      waitingMinutes: waiting,
      finalPrice: waitingFee,
      completedAt: new Date(),
    });
    await this.drivers.markIdle(driverId);
    await this.customers.increment({ id: order.customerId }, 'noShowCount', 1);
    await this.events.record(orderId, 'no_show', ActorType.DRIVER, {
      actorId: driverId,
      payload: { waitingMinutes: waiting, waitingFee },
    });
    order.status = OrderStatus.CUSTOMER_NO_SHOW;
    this.notify(order, OrderStatus.CUSTOMER_NO_SHOW, { waitingFee });
    return { waitingFee };
  }

  async cancelByDriver(orderId: string, driverId: string, reason?: string): Promise<void> {
    const order = await this.mustOwn(orderId, driverId);
    const cancellable = [
      OrderStatus.ACCEPTED,
      OrderStatus.CONFIRMED,
      OrderStatus.ARRIVING,
      OrderStatus.ARRIVED,
    ];
    if (!cancellable.includes(order.status)) throw new BadRequestException('Bu holatda bekor qilib bo‘lmaydi');
    await this.orders.update(orderId, { status: OrderStatus.CANCELLED_BY_DRIVER });
    await this.drivers.markIdle(driverId);
    // Haydovchi qabul qilib keyin tashlab ketsa — har doim bekor darajasiga (2.9).
    await this.events.record(orderId, 'cancelled', ActorType.DRIVER, {
      actorId: driverId,
      reason: reason ?? 'driver_cancel',
      payload: { penalized: true },
    });
    this.notify(order, OrderStatus.CANCELLED_BY_DRIVER);
  }

  /** Mijoz bekor qilishi (bot orqali, ichki). Jarimasiz oyna qoidasi (2.9). */
  async cancelByCustomer(orderId: string, reason?: string): Promise<{ penalized: boolean }> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    const preAccept = [OrderStatus.CREATED, OrderStatus.DISPATCHING];
    const activeCancellable = [
      ...preAccept,
      OrderStatus.ACCEPTED,
      OrderStatus.CONFIRMED,
      OrderStatus.ARRIVING,
      OrderStatus.ARRIVED,
    ];
    if (!activeCancellable.includes(order.status)) throw new BadRequestException('Bekor qilib bo‘lmaydi');

    const cfg = await this.settings.getConfig();
    const withinFreeWindow =
      Date.now() - new Date(order.createdAt).getTime() < cfg.freeCancelSec * 1000;
    // Haydovchi biriktirilgan bo'lsa yoki jarimasiz oynadan chiqqan bo'lsa — jarima.
    const penalized = !withinFreeWindow || !preAccept.includes(order.status);

    await this.orders.update(orderId, { status: OrderStatus.CANCELLED_BY_CUSTOMER });
    if (order.driverId) await this.drivers.markIdle(order.driverId);
    // Bekor darajasi (cancel_rate) metrikasi order_events'dan Sprint 3'da hisoblanadi.
    await this.events.record(orderId, 'cancelled', ActorType.CUSTOMER, {
      actorId: order.customerId,
      reason: reason ?? 'customer_cancel',
      payload: { penalized },
    });
    order.status = OrderStatus.CANCELLED_BY_CUSTOMER;
    this.notify(order, OrderStatus.CANCELLED_BY_CUSTOMER, { penalized });
    return { penalized };
  }

  // ---- Trek va SOS ----

  async addTrack(orderId: string, driverId: string, points: TrackPoint[]): Promise<void> {
    await this.mustOwn(orderId, driverId);
    let track = await this.tracks.findOne({ where: { orderId } });
    if (!track) track = this.tracks.create({ orderId, points: [] });
    track.points = [...track.points, ...points];
    await this.tracks.save(track);
  }

  async sos(orderId: string | null, actor: ActorType, actorId: string | null): Promise<void> {
    await this.sosRepo.save(this.sosRepo.create({ orderId, actor, actorId }));
    this.realtime.emitToOps(SOCKET_EVENTS.ops.alert, {
      type: 'SOS',
      orderId: orderId ?? undefined,
      message: 'SOS signali!',
    });
    this.log.warn(`SOS: order=${orderId} actor=${actor}`);
  }
}
