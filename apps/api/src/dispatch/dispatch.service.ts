import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActorType,
  OrderStatus,
  SOCKET_EVENTS,
  VehicleCategory,
} from '@tty/shared';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { Driver } from '../entities/driver.entity';
import { OrderEventsService } from '../orders/order-events.service';
import { GeoService } from '../geo/geo.service';
import { DriversService } from '../drivers/drivers.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';

interface DispatchState {
  orderId: string;
  customerId: string;
  category: VehicleCategory;
  lng: number;
  lat: number;
  note: string | null;
  customerPhone: string | null;
  customerName: string | null; // showName bo'lsa
  windowSize: number;
  offerTimeoutMs: number;
  radiusSteps: number[];
  radiusIdx: number;
  offered: Map<string, NodeJS.Timeout>;
  declined: Set<string>;
  active: boolean;
  noDriverTimer?: NodeJS.Timeout;
}

const DEFAULT_METER = { baseFare: 4000, perKm: 0, waitingPerMin: 0 };

@Injectable()
export class DispatchService {
  private readonly log = new Logger(DispatchService.name);
  private readonly states = new Map<string, DispatchState>();

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    private readonly events: OrderEventsService,
    private readonly geo: GeoService,
    private readonly drivers: DriversService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async start(orderId: string): Promise<void> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.CREATED) return;
    const customer = await this.customers.findOne({ where: { id: order.customerId } });

    await this.orders.update(orderId, { status: OrderStatus.DISPATCHING });
    await this.events.record(orderId, 'dispatching', ActorType.SYSTEM);
    this.notifyCustomer(order.customerId, orderId, OrderStatus.DISPATCHING);

    const lng = order.pickupLng;
    const lat = order.pickupLat;
    const radiusSteps = this.config
      .get<string>('DISPATCH_RADIUS_STEPS_M')!
      .split(',')
      .map((s) => Number(s.trim()));

    const state: DispatchState = {
      orderId,
      customerId: order.customerId,
      category: order.vehicleCategory,
      lng,
      lat,
      note: order.note,
      customerPhone: customer?.phone ?? null,
      customerName:
        customer?.showName && (customer.firstName || customer.lastName)
          ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
          : null,
      windowSize: this.config.get<number>('DISPATCH_WINDOW_SIZE')!,
      offerTimeoutMs: this.config.get<number>('DISPATCH_OFFER_TIMEOUT_SEC')! * 1000,
      radiusSteps,
      radiusIdx: 0,
      offered: new Map(),
      declined: new Set(),
      active: true,
    };
    state.noDriverTimer = setTimeout(
      () => void this.onNoDriver(state),
      this.config.get<number>('DISPATCH_NO_DRIVER_TIMEOUT_SEC')! * 1000,
    );
    this.states.set(orderId, state);

    await this.fillWindow(state);
  }

  /** Dispatch'ni to'xtatish (operator qo'lda biriktirganda). */
  abort(orderId: string): void {
    const state = this.states.get(orderId);
    if (!state) return;
    state.active = false;
    if (state.noDriverTimer) clearTimeout(state.noDriverTimer);
    for (const [id, t] of state.offered) {
      clearTimeout(t);
      this.realtime.emitToDriver(id, SOCKET_EVENTS.driver.orderOfferCancelled, { orderId });
    }
    state.offered.clear();
    this.states.delete(orderId);
  }

  /** Oynani nomzodlar bilan to'ldirish; kerak bo'lsa radiusni kengaytirish. */
  private async fillWindow(state: DispatchState): Promise<void> {
    if (!state.active) return;

    while (state.offered.size < state.windowSize) {
      const radius = state.radiusSteps[state.radiusIdx];
      const count = state.windowSize + state.offered.size + state.declined.size + 5;
      const nearest = await this.geo.nearestDrivers(state.category, state.lng, state.lat, radius, count);
      const fresh = nearest.filter(
        (c) => !state.offered.has(c.driverId) && !state.declined.has(c.driverId),
      );
      await this.applyRatingTieBreak(fresh);

      if (fresh.length === 0) {
        if (state.radiusIdx < state.radiusSteps.length - 1) {
          state.radiusIdx++;
          continue; // kattaroq radius bilan urinish
        }
        break; // nomzod tugadi
      }

      const need = state.windowSize - state.offered.size;
      for (const c of fresh.slice(0, need)) {
        await this.offer(state, c.driverId, c.distanceM);
      }
    }

    // Hech kim qolmadi va hech kimga taklif yuborilmagan → topilmadi.
    if (state.active && state.offered.size === 0) {
      await this.onNoDriver(state);
    }
  }

  /**
   * Reyting tie-break (2.4): masofa asosiy, lekin ~200m bucket ichida yuqori reyting
   * oldinroq. Nomzodlar shu tartibda taklif oladi.
   */
  private async applyRatingTieBreak(
    candidates: Array<{ driverId: string; distanceM: number }>,
  ): Promise<void> {
    if (candidates.length < 2) return;
    const drivers = await this.driverRepo.find({
      where: { id: In(candidates.map((c) => c.driverId)) },
    });
    const rating = new Map(drivers.map((d) => [d.id, Number(d.ratingAvg)]));
    const bucket = (m: number) => Math.round(m / 200);
    candidates.sort((a, b) => {
      const bd = bucket(a.distanceM) - bucket(b.distanceM);
      if (bd !== 0) return bd;
      const rd = (rating.get(b.driverId) ?? 0) - (rating.get(a.driverId) ?? 0);
      if (rd !== 0) return rd;
      return a.distanceM - b.distanceM;
    });
  }

  private async offer(state: DispatchState, driverId: string, distanceM: number): Promise<void> {
    const timeout = setTimeout(
      () => void this.decline(state, driverId, 'timeout'),
      state.offerTimeoutMs,
    );
    state.offered.set(driverId, timeout);

    this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderOffer, {
      orderId: state.orderId,
      pickup: { lat: state.lat, lng: state.lng },
      distanceM,
      category: state.category,
      note: state.note ?? undefined,
      customer: { phone: state.customerPhone ?? '', name: state.customerName ?? undefined },
    });
    await this.events.record(state.orderId, 'offered', ActorType.SYSTEM, {
      actorId: driverId,
      payload: { distanceM, radius: state.radiusSteps[state.radiusIdx] },
    });
    // Fon rejimida push (ilova ochiq bo'lmasa) — stub, keyin FCM.
    void this.notifications.pushToDriver(driverId, 'Yangi buyurtma', `${distanceM} m uzoqlikda`);
  }

  private async decline(state: DispatchState, driverId: string, reason: string): Promise<void> {
    const t = state.offered.get(driverId);
    if (t) clearTimeout(t);
    if (!state.offered.delete(driverId)) return;
    state.declined.add(driverId);
    this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderOfferCancelled, {
      orderId: state.orderId,
    });
    await this.events.record(state.orderId, 'declined', ActorType.DRIVER, {
      actorId: driverId,
      reason,
    });
    await this.fillWindow(state);
  }

  /** Gateway'dan keladi: haydovchi javobi. */
  async handleResponse(orderId: string, driverId: string, accept: boolean): Promise<void> {
    const state = this.states.get(orderId);
    if (!state || !state.active) {
      if (accept) {
        this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderOfferCancelled, { orderId });
      }
      return;
    }
    if (!state.offered.has(driverId)) return; // eskirgan javob
    if (accept) await this.tryAssign(state, driverId);
    else await this.decline(state, driverId, 'declined');
  }

  /** Atomik biriktirish — birinchi qabul yutadi. */
  private async tryAssign(state: DispatchState, driverId: string): Promise<void> {
    const res = await this.orders
      .createQueryBuilder()
      .update(Order)
      .set({ driverId, status: OrderStatus.ACCEPTED, acceptedAt: () => 'now()' })
      .where('id = :id AND status = :status', {
        id: state.orderId,
        status: OrderStatus.DISPATCHING,
      })
      .execute();

    if (!res.affected) {
      this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderOfferCancelled, {
        orderId: state.orderId,
      });
      return;
    }
    await this.finalize(state, driverId);
  }

  private async finalize(state: DispatchState, driverId: string): Promise<void> {
    state.active = false;
    if (state.noDriverTimer) clearTimeout(state.noDriverTimer);

    for (const [otherId, t] of state.offered) {
      clearTimeout(t);
      if (otherId !== driverId) {
        this.realtime.emitToDriver(otherId, SOCKET_EVENTS.driver.orderOfferCancelled, {
          orderId: state.orderId,
        });
      }
    }
    state.offered.clear();
    this.states.delete(state.orderId);

    await this.drivers.markOnTrip(driverId);
    await this.events.record(state.orderId, 'accepted', ActorType.DRIVER, { actorId: driverId });

    const info = await this.drivers.findWithVehicle(driverId);
    this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderAssigned, {
      orderId: state.orderId,
      customer: { phone: state.customerPhone ?? '', name: state.customerName ?? undefined },
      meterConfig: DEFAULT_METER,
    });

    const driverCard = info
      ? {
          name: [info.driver.firstName, info.driver.lastName].filter(Boolean).join(' ') || 'Haydovchi',
          phone: info.driver.phone,
          vehicle: [info.vehicle?.color, info.vehicle?.make, info.vehicle?.model]
            .filter(Boolean)
            .join(' '),
          plate: info.vehicle?.plate ?? '',
          ratingAvg: Number(info.driver.ratingAvg),
        }
      : undefined;

    this.realtime.emitToCustomer(state.customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId: state.orderId,
      status: OrderStatus.ACCEPTED,
      driver: driverCard,
    });
    this.realtime.emitToOps(SOCKET_EVENTS.ops.orderUpdate, {
      orderId: state.orderId,
      status: OrderStatus.ACCEPTED,
      driverId,
    });
    this.log.log(`Buyurtma ${state.orderId} → haydovchi ${driverId} ga biriktirildi`);
  }

  private async onNoDriver(state: DispatchState): Promise<void> {
    if (!state.active) return;
    state.active = false;
    if (state.noDriverTimer) clearTimeout(state.noDriverTimer);
    for (const [id, t] of state.offered) {
      clearTimeout(t);
      this.realtime.emitToDriver(id, SOCKET_EVENTS.driver.orderOfferCancelled, {
        orderId: state.orderId,
      });
    }
    state.offered.clear();
    this.states.delete(state.orderId);

    const res = await this.orders
      .createQueryBuilder()
      .update(Order)
      .set({ status: OrderStatus.NO_DRIVER })
      .where('id = :id AND status = :status', {
        id: state.orderId,
        status: OrderStatus.DISPATCHING,
      })
      .execute();
    if (!res.affected) return;

    await this.events.record(state.orderId, 'no_driver', ActorType.SYSTEM);
    this.notifyCustomer(state.customerId, state.orderId, OrderStatus.NO_DRIVER);
    this.realtime.emitToOps(SOCKET_EVENTS.ops.alert, {
      type: 'NO_DRIVER',
      orderId: state.orderId,
      message: 'Haydovchi topilmadi',
    });
    this.log.warn(`Buyurtma ${state.orderId} → NO_DRIVER`);
  }

  private notifyCustomer(customerId: string, orderId: string, status: OrderStatus): void {
    this.realtime.emitToCustomer(customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId,
      status,
    });
  }
}
