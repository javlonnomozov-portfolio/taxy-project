import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActorType, OrderStatus, OrderType, SOCKET_EVENTS, VehicleCategory } from '@tty/shared';
import { Order } from '../entities/order.entity';
import { ACTIVE_STATUSES } from '../orders/orders.constants';
import { OrderEventsService } from '../orders/order-events.service';
import { DriversService } from '../drivers/drivers.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { SettingsService } from '../settings/settings.service';
import { BillingService } from '../billing/billing.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsConfig } from '../entities/settings.entity';
import { Tariff } from '../entities/tariff.entity';

@Injectable()
export class OpsService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly events: OrderEventsService,
    private readonly drivers: DriversService,
    private readonly dispatch: DispatchService,
    private readonly settings: SettingsService,
    private readonly billing: BillingService,
    private readonly realtime: RealtimeService,
  ) {}

  listOrders(status?: OrderStatus): Promise<Order[]> {
    return this.orders.find({
      where: status ? { status } : { status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** Qo'lda biriktirish (NO_DRIVER yoki DISPATCHING holatida). */
  async assign(orderId: string, driverId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (![OrderStatus.NO_DRIVER, OrderStatus.DISPATCHING].includes(order.status)) {
      throw new BadRequestException('Bu holatda qo‘lda biriktirib bo‘lmaydi');
    }
    this.dispatch.abort(orderId);
    await this.orders.update(orderId, {
      driverId,
      status: OrderStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    await this.drivers.markOnTrip(driverId);
    await this.events.record(orderId, 'accepted', ActorType.OPERATOR, {
      actorId: driverId,
      reason: 'manual_assign',
    });
    const info = await this.drivers.findWithVehicle(driverId);
    this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderAssigned, {
      orderId,
      customer: {},
      meterConfig: { baseFare: 4000, perKm: 0, waitingPerMin: 0 },
    });
    this.realtime.emitToCustomer(order.customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId,
      status: OrderStatus.ACCEPTED,
      driver: info
        ? { name: info.driver.firstName ?? 'Haydovchi', phone: info.driver.phone }
        : undefined,
    });
    this.realtime.emitToOps(SOCKET_EVENTS.ops.orderUpdate, { orderId, status: OrderStatus.ACCEPTED, driverId });
    return (await this.orders.findOne({ where: { id: orderId } }))!;
  }

  /** Oldindan buyurtmalar ro'yxati (tasdiqlashni kutayotgan). */
  listScheduled(): Promise<Order[]> {
    return this.orders.find({
      where: { orderType: OrderType.SCHEDULED, status: OrderStatus.CREATED },
      order: { scheduledAt: 'ASC' },
      take: 200,
    });
  }

  /** Operator mijoz bilan tasdiqladi → dispatch boshlanadi (2.12). */
  async confirmScheduled(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.orderType !== OrderType.SCHEDULED || order.status !== OrderStatus.CREATED) {
      throw new BadRequestException('Bu oldindan buyurtma tasdiqlash uchun mos emas');
    }
    await this.events.record(orderId, 'scheduled_confirmed', ActorType.OPERATOR);
    await this.dispatch.start(orderId);
    return (await this.orders.findOne({ where: { id: orderId } }))!;
  }

  async close(orderId: string, reason?: string): Promise<void> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    this.dispatch.abort(orderId);
    await this.orders.update(orderId, { status: OrderStatus.CLOSED_BY_OPERATOR });
    if (order.driverId) await this.drivers.markIdle(order.driverId);
    await this.events.record(orderId, 'closed', ActorType.OPERATOR, { reason });
    this.realtime.emitToCustomer(order.customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId,
      status: OrderStatus.CLOSED_BY_OPERATOR,
    });
    this.realtime.emitToOps(SOCKET_EVENTS.ops.orderUpdate, {
      orderId,
      status: OrderStatus.CLOSED_BY_OPERATOR,
    });
  }

  listDrivers() {
    return this.drivers.listAll();
  }
  createDriver(data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    vehicle: { make?: string; model?: string; color?: string; plate?: string; category: VehicleCategory };
  }) {
    return this.drivers.createByAdmin(data);
  }
  topUpDriver(driverId: string, amount: number, note?: string) {
    return this.billing.topUp(driverId, amount, note);
  }
  driverTransactions(driverId: string) {
    return this.billing.listTransactions(driverId);
  }
  approveDriver(id: string) {
    return this.drivers.approve(id);
  }
  setBilling(id: string, mode: string, config?: Record<string, unknown>) {
    return this.drivers.setBilling(id, mode, config);
  }
  blockDriver(id: string) {
    return this.drivers.block(id);
  }

  getSettings() {
    return this.settings.getConfig();
  }
  updateSettings(patch: Partial<SettingsConfig>) {
    return this.settings.updateConfig(patch);
  }
  listTariffs() {
    return this.settings.listTariffs();
  }
  updateTariff(category: VehicleCategory, patch: Partial<Tariff>) {
    return this.settings.updateTariff(category, patch);
  }
}
