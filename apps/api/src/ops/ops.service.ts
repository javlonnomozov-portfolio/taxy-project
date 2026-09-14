import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActorType, OrderStatus, OrderType, PanelRole, SOCKET_EVENTS, VehicleCategory } from '@tty/shared';
import { Order } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { ACTIVE_STATUSES } from '../orders/orders.constants';
import { OrderEventsService } from '../orders/order-events.service';
import { DriversService } from '../drivers/drivers.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { SettingsService } from '../settings/settings.service';
import { BillingService } from '../billing/billing.service';
import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsConfig } from '../entities/settings.entity';
import { Tariff } from '../entities/tariff.entity';

@Injectable()
export class OpsService {
  private readonly log = new Logger(OpsService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly events: OrderEventsService,
    private readonly drivers: DriversService,
    private readonly dispatch: DispatchService,
    private readonly settings: SettingsService,
    private readonly billing: BillingService,
    private readonly auth: AuthService,
    private readonly realtime: RealtimeService,
  ) {}

  createAdmin(login: string, password: string, role: PanelRole) {
    return this.auth.createAdmin(login, password, role);
  }

  listOrders(status?: OrderStatus): Promise<Order[]> {
    if (status) {
      return this.orders.find({ where: { status }, order: { createdAt: 'DESC' }, take: 200 });
    }
    // Faol zakazlar + so'nggi 30 daqiqadagi NO_DRIVER (operator qo'lda biriktirishi uchun).
    const since = new Date(Date.now() - 30 * 60_000);
    return this.orders
      .createQueryBuilder('o')
      .where('o.status IN (:...active)', { active: ACTIVE_STATUSES })
      .orWhere('o.status = :nd AND o.created_at > :since', { nd: OrderStatus.NO_DRIVER, since })
      .orderBy('o.created_at', 'DESC')
      .take(200)
      .getMany();
  }

  /** Qo'lda biriktirish (NO_DRIVER yoki DISPATCHING holatida). */
  async assign(orderId: string, driverId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (![OrderStatus.NO_DRIVER, OrderStatus.DISPATCHING].includes(order.status)) {
      throw new BadRequestException('Bu holatda qo‘lda biriktirib bo‘lmaydi');
    }
    this.dispatch.abort(orderId);
    this.dispatch.cancelOperatorFallback(orderId);
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
    const tariff = await this.settings.getTariff(order.vehicleCategory);
    this.realtime.emitToDriver(driverId, SOCKET_EVENTS.driver.orderAssigned, {
      orderId,
      pickup: { lat: order.pickupLat, lng: order.pickupLng },
      pickupAddress: order.pickupAddress ?? undefined,
      dest: order.destLat != null ? { lat: order.destLat, lng: order.destLng! } : undefined,
      destAddress: order.destAddress ?? undefined,
      customer: {},
      meterConfig: tariff
        ? { baseFare: tariff.baseFare, perKm: tariff.perKm, waitingPerMin: tariff.waitingPerMin }
        : { baseFare: 4000, perKm: 0, waitingPerMin: 0 },
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

  /**
   * Buyurtma narxini tuzatish — taksometrdan TASHQARI summa.
   *
   * NEGA KERAK: hayotda kelishuv taksometrdan chetga chiqadi — mijozda katta
   * yuk bor, kutish uzoq bo'ldi, mashina kirmaydigan ko'chaga borish kerak.
   * Avval bular telefon orqali hal bo'lib, pul TIZIMDAN TASHQARIDA olinardi:
   * hisobotda ham, komissiyada ham ko'rinmasdi.
   *
   * NEGA TOIFA O'ZGARTIRILMAYDI: "zakazni Comfort'ga o'tkazish" butun hisobni
   * (baza + km + kutish) qayta yozadi va safar o'rtasida taksometr sakrab
   * ketadi. Qo'shimcha esa alohida qator bo'lib turadi.
   *
   * FAQAT FAOL buyurtmada: yakunlangan safarning narxi allaqachon mijozga
   * aytilgan va haydovchidan komissiya yechilgan — uni orqaga o'zgartirish
   * ikkalasini ham buzardi.
   */
  async adjustFare(
    orderId: string,
    amount: number,
    reason: string,
    actorId?: string,
  ): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (!ACTIVE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Yakunlangan buyurtma narxini o\u2018zgartirib bo\u2018lmaydi');
    }

    const before = Number(order.fareAdjustment) || 0;
    await this.orders.update(orderId, {
      fareAdjustment: amount,
      fareAdjustmentReason: reason,
    });
    await this.events.record(orderId, 'fare_adjusted', ActorType.OPERATOR, {
      actorId,
      reason,
      payload: { before, after: amount },
    });

    // Ikkala tomonga ham AYTAMIZ. Haydovchi bilmasa mijozdan noto'g'ri summa
    // so'rardi; mijoz bilmasa yakunda kutilmagan hisob chiqardi.
    if (order.driverId) {
      this.realtime.emitToDriver(order.driverId, SOCKET_EVENTS.driver.announcement, {
        orderId,
        message: `${reason}: ${amount > 0 ? '+' : ''}${amount}`,
      });
    }
    this.realtime.emitToCustomer(order.customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId,
      status: order.status,
      fareAdjustment: amount,
      fareAdjustmentReason: reason,
    });
    this.realtime.emitToOps(SOCKET_EVENTS.ops.orderUpdate, {
      orderId,
      status: order.status,
      fareAdjustment: amount,
    });

    this.log.log(`Narx tuzatildi (zakaz ${orderId}): ${before} -> ${amount} (${reason})`);
    return (await this.orders.findOne({ where: { id: orderId } }))!;
  }

  /** Foydalanuvchilar (mijozlar) ro'yxati. */
  listCustomers() {
    return this.customers.find({ order: { createdAt: 'DESC' }, take: 500 });
  }

  /** Zakazlar tarixi — joriy + tugagan (so'nggilar). Ixtiyoriy status filtri. */
  ordersHistory(status?: OrderStatus) {
    return this.orders.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 300,
    });
  }

  /** Operator xaritadan tanlagan haydovchiga yo'naltirilgan taklif yuboradi. */
  async offerToDriver(orderId: string, driverId: string): Promise<{ ok: true }> {
    await this.dispatch.offerToDriver(orderId, driverId);
    return { ok: true };
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
    const wasNoDriver = order.status === OrderStatus.NO_DRIVER;
    this.dispatch.abort(orderId);
    this.dispatch.cancelOperatorFallback(orderId);
    await this.orders.update(orderId, { status: OrderStatus.CLOSED_BY_OPERATOR });
    if (order.driverId) {
      await this.drivers.markIdle(order.driverId);
      this.realtime.emitToDriver(order.driverId, SOCKET_EVENTS.driver.tripEnded, {
        orderId,
        reason: 'operator_close',
      });
    }
    await this.events.record(orderId, 'closed', ActorType.OPERATOR, { reason });
    // NO_DRIVER zakazni operator yopsa — mijozga "taksi yo'q" (dispatcher qarori);
    // aks holda oddiy bekor qilish xabari.
    this.realtime.emitToCustomer(order.customerId, SOCKET_EVENTS.customer.orderStatus, {
      orderId,
      status: wasNoDriver ? OrderStatus.NO_DRIVER : OrderStatus.CLOSED_BY_OPERATOR,
    });
    this.realtime.emitToOps(SOCKET_EVENTS.ops.orderUpdate, {
      orderId,
      status: OrderStatus.CLOSED_BY_OPERATOR,
    });
  }

  listDrivers() {
    return this.drivers.listAll();
  }
  /** Xarita boshlang'ich yuklamasi: onlayn/safardagi taksilar oxirgi joylashuvi bilan. */
  listActiveDrivers() {
    return this.drivers.listActiveWithLocation();
  }
  createDriver(data: {
    phone: string;
    firstName?: string;
    lastName?: string;
    vehicle: {
      make?: string;
      model?: string;
      color?: string;
      plate?: string;
      category: VehicleCategory;
      /** Yo'lovchi o'rinlari (Damas 7, Cobalt 4). Berilmasa entity default = 4. */
      seats?: number;
    };
  }) {
    return this.drivers.createByAdmin(data);
  }
  updateDriverVehicle(
    driverId: string,
    patch: { make?: string; model?: string; color?: string; plate?: string; seats?: number },
  ) {
    return this.drivers.updateVehicle(driverId, patch);
  }
  /**
   * Haydovchi parolini tiklash — bir martalik parol qaytaradi.
   * Panel uni bir marta ko'rsatadi va qayta so'rab bo'lmaydi.
   */
  /** Operator: Comfort topilmagan zakazni Standart'ga o'tkazib qayta qidirish. */
  switchOrderToStandard(orderId: string, actorId?: string) {
    return this.dispatch.switchToStandard(orderId, ActorType.OPERATOR, actorId);
  }

  /** Haydovchilar ro'yxati: qidiruv, filtr, sahifalash (yuzlab haydovchi uchun). */
  searchDrivers(filters: Parameters<DriversService['search']>[0]) {
    return this.drivers.search(filters);
  }

  updateDriverProfile(driverId: string, patch: { firstName?: string; lastName?: string; phone?: string }) {
    return this.drivers.updateProfile(driverId, patch);
  }

  /** Haydovchining so'nggi safarlari — panel oynasi uchun ixcham ko'rinish. */
  async driverTrips(driverId: string) {
    const rows = await this.drivers.tripHistory(driverId);
    return rows.map((o) => ({
      id: o.id,
      status: o.status,
      category: o.vehicleCategory,
      finalPrice: o.finalPrice,
      distanceM: o.distanceM,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
    }));
  }

  resetDriverPassword(driverId: string) {
    return this.drivers.resetPassword(driverId);
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

  /**
   * Dispatch metrikalari — avval bu sonlar faqat log matnida edi, ya'ni
   * "necha foiz zakazga taksi topilmadi" degan savolga javob yo'q edi.
   * Manba: `orders` (holatlar) + `order_events` (qabul vaqti).
   */
  async metrics(hours = 24): Promise<{
    windowHours: number;
    total: number;
    byStatus: Record<string, number>;
    noDriverRate: number;
    completionRate: number;
    avgAcceptSec: number | null;
    avgFare: number | null;
  }> {
    const since = new Date(Date.now() - hours * 3_600_000);

    const statusRows = await this.orders
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.created_at >= :since', { since })
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of statusRows) {
      const n = Number(r.count);
      byStatus[r.status] = n;
      total += n;
    }

    // Yaratilgandan qabul qilingangacha o'rtacha vaqt (sekund).
    const accept = await this.orders
      .createQueryBuilder('o')
      .select('AVG(EXTRACT(EPOCH FROM (o.accepted_at - o.created_at)))', 'avg')
      .where('o.created_at >= :since AND o.accepted_at IS NOT NULL', { since })
      .getRawOne<{ avg: string | null }>();

    const fare = await this.orders
      .createQueryBuilder('o')
      .select('AVG(o.final_price)', 'avg')
      .where('o.created_at >= :since AND o.status = :st', { since, st: OrderStatus.COMPLETED })
      .getRawOne<{ avg: string | null }>();

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
    return {
      windowHours: hours,
      total,
      byStatus,
      noDriverRate: pct(byStatus[OrderStatus.NO_DRIVER] ?? 0),
      completionRate: pct(byStatus[OrderStatus.COMPLETED] ?? 0),
      avgAcceptSec: accept?.avg ? Math.round(Number(accept.avg)) : null,
      avgFare: fare?.avg ? Math.round(Number(fare.avg)) : null,
    };
  }
}
