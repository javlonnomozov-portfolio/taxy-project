import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { ApprovalStatus, BillingMode, DriverStatus, OrderStatus, VehicleCategory } from '@tty/shared';
import * as bcrypt from 'bcryptjs';
import { SOCKET_EVENTS } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { GeoService } from '../geo/geo.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Driver } from '../entities/driver.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Order } from '../entities/order.entity';
import { Transaction } from '../entities/transaction.entity';
import { AccountStatusService } from '../auth/account-status.service';
import { SEED_RATING } from '../reputation/reputation.constants';

// Haydovchi tarixida ko'rinadigan tugagan holatlar.
const FINISHED_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.CUSTOMER_NO_SHOW,
  OrderStatus.CANCELLED_BY_CUSTOMER,
  OrderStatus.CANCELLED_BY_DRIVER,
];

/**
 * Panelga chiqariladigan haydovchi — parol hash'i va push tokenisiz.
 *
 * NEGA: `GET /ops/drivers` butun entity'ni qaytarardi, ya'ni javobda har
 * haydovchining bcrypt hash'i va Expo push tokeni bor edi. Panel ularning
 * ikkalasini ham ishlatmaydi (qidirib tekshirildi), lekin javob brauzer
 * tarixida, proxy loglarida va operator ekranida qolardi. Push token o'zi
 * ham yetarli: uni bilgan odam haydovchiga soxta bildirishnoma yubora oladi.
 */
export type DriverView = Omit<Driver, 'passwordHash' | 'pushToken'>;

export function toDriverView(d: Driver): DriverView {
  const { passwordHash, pushToken, ...rest } = d;
  void passwordHash;
  void pushToken;
  return rest;
}

@Injectable()
export class DriversService {
  private readonly log = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Transaction) private readonly txns: Repository<Transaction>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly geo: GeoService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly accounts: AccountStatusService,
  ) {}

  private catKey(driverId: string): string {
    return `driver:cat:${driverId}`;
  }

  private genTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  }

  /**
   * Super-admin ofisda haydovchini qo'lda qo'shadi (2.11 KYC).
   * Bir martalik temp parol yaratiladi (bir marta ko'rsatiladi), birinchi kirishda
   * haydovchi uni almashtiradi. Haydovchi darrov approved (ofisda tekshirilgan).
   */
  async createByAdmin(data: {
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
  }): Promise<{ driver: DriverView; tempPassword: string }> {
    const existing = await this.drivers.findOne({ where: { phone: data.phone } });
    if (existing) throw new ForbiddenException('Bu telefon bilan haydovchi allaqachon mavjud');

    const tempPassword = this.genTempPassword();
    const driver = await this.drivers.save(
      this.drivers.create({
        phone: data.phone,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        passwordHash: await bcrypt.hash(tempPassword, 10),
        mustChangePassword: true,
        approvalStatus: ApprovalStatus.APPROVED,
        // Yangi haydovchi 0.00 bilan emas, 5.00 bilan boshlaydi — "birinchi
        // mijoz 5 yulduz bergan" degan urug' ovoz. Haqiqiy baholar kelgani
        // sari suyuladi (`recomputeDriver`).
        ratingAvg: SEED_RATING,
        // Billing rejimi ATAYLAB ochiq yoziladi. Entity default'i
        // `SUBSCRIPTION` va u safardan HECH NARSA yechmaydi — ya'ni operator
        // qo'lda o'zgartirmasa, yangi haydovchi bepul ishlab yuraverardi va
        // buni hech qanday xato ko'rsatmasdi (prod'da aynan shunday bo'lgan).
        // Boshqacha kelishuv bo'lsa admin panelidan o'zgartiriladi.
        billingMode: BillingMode.PER_ORDER,
      }),
    );
    await this.vehicles.save(this.vehicles.create({ driverId: driver.id, ...data.vehicle }));
    // Yangi haydovchida hash ALLAQACHON o'rnatilgan — uni javobga qo'shmaymiz.
    return { driver: toDriverView(driver), tempPassword };
  }

  async approve(driverId: string): Promise<DriverView> {
    const driver = await this.mustFind(driverId);
    driver.approvalStatus = ApprovalStatus.APPROVED;
    const saved = await this.drivers.save(driver);
    await this.accounts.invalidate('driver', driverId); // yana kira olsin
    return toDriverView(saved);
  }

  async block(driverId: string): Promise<DriverView> {
    const driver = await this.mustFind(driverId);
    driver.approvalStatus = ApprovalStatus.BLOCKED;
    driver.status = DriverStatus.OFFLINE;
    await this.geo.removeFromAll(driverId);
    const saved = await this.drivers.save(driver);
    // Blok DARHOL kuchga kirsin: hisob keshini tozalaymiz (aks holda TTL tugagunча
    // eski token ishlardi) va ochiq socketlarni uzamiz (ular guard'dan allaqachon
    // o'tib bo'lgan va zakaz qabul qilishda davom etardi).
    await this.accounts.invalidate('driver', driverId);
    await this.realtime.disconnectDriver(driverId, 'blocked');
    return toDriverView(saved);
  }

  async listAll(): Promise<DriverView[]> {
    // Mashina ham keladi: admin panel o'rinlar sonini (Damas 7 / Cobalt 4)
    // ko'rsatishi va o'zgartirishi kerak — busiz sig'im filtri amalda
    // sozlanmaydi (CUSTOMER-APP-PLAN.md §4b.5).
    const rows = await this.drivers.find({
      order: { createdAt: 'DESC' },
      take: 200,
      relations: { vehicles: true },
    });
    return rows.map(toDriverView);
  }

  /** Haydovchining mashinasini tahrirlash (o'rinlar soni, rusum, raqam). */
  async updateVehicle(
    driverId: string,
    patch: { make?: string; model?: string; color?: string; plate?: string; seats?: number },
  ): Promise<Vehicle> {
    const vehicle = await this.vehicles.findOne({ where: { driverId } });
    if (!vehicle) throw new NotFoundException('Haydovchida mashina yo‘q');
    Object.assign(vehicle, patch);
    return this.vehicles.save(vehicle);
  }

  async setBilling(
    driverId: string,
    mode: string,
    config?: Record<string, unknown>,
  ): Promise<DriverView> {
    const driver = await this.mustFind(driverId);
    driver.billingMode = mode as Driver['billingMode'];
    if (config) driver.billingConfig = config;
    return toDriverView(await this.drivers.save(driver));
  }

  async getCategory(driverId: string): Promise<VehicleCategory> {
    const cached = await this.redis.get(this.catKey(driverId));
    if (cached) return cached as VehicleCategory;
    const vehicle = await this.vehicles.findOne({ where: { driverId } });
    const cat = vehicle?.category ?? VehicleCategory.STANDARD;
    await this.redis.set(this.catKey(driverId), cat, 'EX', 3600);
    return cat;
  }

  async goOnline(driverId: string): Promise<void> {
    const driver = await this.mustFind(driverId);
    if (driver.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Haydovchi hali tasdiqlanmagan');
    }
    await this.drivers.update(driverId, {
      status: DriverStatus.ONLINE_IDLE,
      lastSeenAt: new Date(),
    });
    // toifani keshlab qo'yamiz (location yangilanishlarida tez ishlatish uchun)
    const category = await this.getCategory(driverId);

    // MUHIM: dispatch faqat Redis geo-indeksidan qidiradi (`geo:drivers:<toifa>`), DB
    // statusidan EMAS. Ilgari bu yerda geo-indeksga yozilmasdi — haydovchi ilovada
    // yashil "Onlayn" ko'rinardi, lekin dispatch uchun MAVJUD EMAS edi va zakaz
    // darhol NO_DRIVER bo'lardi. Indeksga faqat `driver:location` tushganda kirardi;
    // telefon qimirlamasa (Android `distanceInterval` filtri) GPS yangilanishi
    // kelmasligi mumkin, `goOffline` esa indeksdan o'chirib yuborgan bo'lardi
    // (har uzilish/qayta ulanishda shunday bo'ladi).
    // Shuning uchun oxirgi ma'lum joylashuvdan indeksni tiklaymiz — xuddi
    // `markIdle()` dagi kabi. Ilova birinchi GPS nuqtasini yuborishi bilan u
    // aniqroq qiymat bilan ustidan yoziladi.
    if (driver.lastLat != null && driver.lastLng != null) {
      await this.geo.setDriverLocation(driverId, category, driver.lastLng, driver.lastLat);
    }
  }

  async goOffline(driverId: string): Promise<void> {
    await this.drivers.update(driverId, { status: DriverStatus.OFFLINE });
    await this.geo.removeFromAll(driverId);
  }

  async updateLocation(driverId: string, lat: number, lng: number): Promise<void> {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    // Onlayn yoki safardagi haydovchidan qabul qilamiz; oflayn — e'tiborsiz.
    if (
      !driver ||
      (driver.status !== DriverStatus.ONLINE_IDLE && driver.status !== DriverStatus.ON_TRIP)
    ) {
      return;
    }
    const category = await this.getCategory(driverId);
    const now = new Date();
    // Oxirgi joylashuvni HAR DOIM saqlaymiz — safar davomida ham (mijoz/kuzatuv uchun).
    await this.drivers.update(driverId, {
      lastLat: lat,
      lastLng: lng,
      lastLocationAt: now,
      lastSeenAt: now,
    });
    // Geo-indeksga faqat bo'sh (ONLINE_IDLE) haydovchi tushadi — dispatch shu yerdan qidiradi.
    if (driver.status === DriverStatus.ONLINE_IDLE) {
      await this.geo.setDriverLocation(driverId, category, lng, lat);
    }
    // Operator jonli xaritasi uchun (onlayn va safardagi taksilar).
    this.realtime.emitToOps(SOCKET_EVENTS.ops.driverUpdate, {
      driverId,
      lat,
      lng,
      status: driver.status,
      category,
    });
  }

  /** Xarita boshlang'ich yuklamasi: onlayn/safardagi haydovchilar (ism, mashina, joylashuv). */
  async listActiveWithLocation(): Promise<
    Array<{
      driverId: string;
      name: string;
      phone: string;
      plate: string;
      car: string;
      ratingAvg: number;
      lat: number;
      lng: number;
      status: DriverStatus;
      category: VehicleCategory;
    }>
  > {
    const drivers = await this.drivers.find({
      where: [{ status: DriverStatus.ONLINE_IDLE }, { status: DriverStatus.ON_TRIP }],
    });
    const withLoc = drivers.filter((d) => d.lastLat != null && d.lastLng != null);
    if (withLoc.length === 0) return [];
    const vehicles = await this.vehicles.find({
      where: { driverId: In(withLoc.map((d) => d.id)) },
    });
    const vmap = new Map(vehicles.map((v) => [v.driverId, v]));
    return withLoc.map((d) => {
      const v = vmap.get(d.id);
      return {
        driverId: d.id,
        name: [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Haydovchi',
        phone: d.phone,
        plate: v?.plate ?? '',
        car: [v?.color, v?.make, v?.model].filter(Boolean).join(' '),
        ratingAvg: d.ratingAvg,
        lat: d.lastLat!,
        lng: d.lastLng!,
        status: d.status,
        category: v?.category ?? VehicleCategory.STANDARD,
      };
    });
  }

  /** Bitta haydovchining oxirgi ma'lum joylashuvi va holati (mijozga ko'rsatish uchun). */
  async lastLocation(
    driverId: string,
  ): Promise<{ lat: number; lng: number; at: Date | null; status: DriverStatus } | null> {
    const d = await this.drivers.findOne({ where: { id: driverId } });
    if (!d || d.lastLat == null || d.lastLng == null) return null;
    return { lat: d.lastLat, lng: d.lastLng, at: d.lastLocationAt, status: d.status };
  }

  /** Dispatch biriktirgach — band, geo-indeksdan chiqadi. */
  async markOnTrip(driverId: string): Promise<void> {
    await this.drivers.update(driverId, { status: DriverStatus.ON_TRIP });
    await this.geo.removeFromAll(driverId);
  }

  /**
   * Safar tugagach yoki bekor bo'lgach — yana bo'sh.
   *
   * MUHIM: `markOnTrip()` haydovchini Redis geo-indeksidan o'chirgan edi, shuning uchun
   * bu yerda uni QAYTARAMIZ. Aks holda haydovchi safardan keyin ilovaning keyingi GPS
   * yangilanishigacha dispatch uchun ko'rinmay turadi (GPS to'xtab qolsa — umuman).
   */
  async markIdle(driverId: string): Promise<void> {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver) return;
    // Oflayn haydovchini "bo'sh" qilib qo'ymaymiz — ilovasi yopiq bo'lsa taklif javobsiz qoladi.
    if (driver.status === DriverStatus.OFFLINE) return;

    await this.drivers.update(driverId, { status: DriverStatus.ONLINE_IDLE });
    if (driver.lastLat != null && driver.lastLng != null) {
      const category = await this.getCategory(driverId);
      await this.geo.setDriverLocation(driverId, category, driver.lastLng, driver.lastLat);
    }
  }

  /**
   * Parolni tiklash — yangi BIR MARTALIK parol qaytaradi.
   *
   * NEGA KERAK: operator haydovchining parolini bilmaydi va uni tiklashning
   * yo'li yo'q edi. 2026-09-13 da Damasli haydovchi aynan shu sabab
   * BLOKLANGAN (kira olmagani uchun), ya'ni butun Standart toifa bitta
   * mashinasiz qolgan.
   *
   * Parol javobda FAQAT SHU SAFAR qaytadi — bazada bcrypt hash saqlanadi,
   * qayta ko'rsatib bo'lmaydi. `mustChangePassword` yoqiladi: haydovchi
   * birinchi kirishda o'zi almashtiradi.
   *
   * MAVJUD SESSIYALAR UZILMAYDI. Bu ataylab: haydovchi safarda bo'lishi
   * mumkin, uni yo'l o'rtasida tizimdan chiqarish zakazni yo'qotardi.
   * Telefon yo'qolgan holatda operator avval bloklaydi (u soketlarni uzadi),
   * keyin parolni tiklaydi.
   */
  async resetPassword(driverId: string): Promise<{ tempPassword: string }> {
    const driver = await this.mustFind(driverId);
    const tempPassword = this.genTempPassword();
    await this.drivers.update(driver.id, {
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
    });
    this.log.log(`Parol tiklandi: haydovchi ${driver.id}`);
    return { tempPassword };
  }

  async setPushToken(driverId: string, token: string): Promise<void> {
    await this.drivers.update(driverId, { pushToken: token });
  }

  async findById(id: string): Promise<Driver | null> {
    return this.drivers.findOne({ where: { id } });
  }

  async findWithVehicle(id: string): Promise<{ driver: Driver; vehicle: Vehicle | null } | null> {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) return null;
    const vehicle = await this.vehicles.findOne({ where: { driverId: id } });
    return { driver, vehicle };
  }

  // --- Haydovchining o'z kabineti (ilova ekranlari uchun) ---

  /** Balans + billing rejimi. Manfiy balans ilovada ogohlantirish sifatida ko'rsatiladi. */
  async balanceInfo(driverId: string): Promise<{
    balance: number;
    billingMode: string;
    billingConfig: Record<string, unknown>;
  }> {
    const d = await this.mustFind(driverId);
    return {
      balance: d.balance,
      billingMode: d.billingMode,
      billingConfig: (d.billingConfig ?? {}) as Record<string, unknown>,
    };
  }

  /** Balans harakati — komissiya va ofisda to'ldirish yozuvlari. */
  transactions(driverId: string): Promise<Transaction[]> {
    return this.txns.find({ where: { driverId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  /**
   * Yakunlangan/tugagan safarlar tarixi — VAQT bo'yicha, eng yangisi birinchi.
   *
   * DIQQAT: `ORDER BY completed_at DESC` ISHLAMAYDI. Postgres'da DESC uchun
   * default `NULLS FIRST`, bekor qilingan zakazlarda esa `completed_at` BO'SH.
   * Natijada barcha bekor qilinganlar ro'yxat BOSHINI egallab, yakunlangan
   * safarlar pastga surilardi (va ular orasida sanalar ham tartibsiz chiqardi).
   * Haydovchi "hamma safarim bekor qilingan deb turibdi" deb shikoyat qilgan —
   * aslida yakunlanganlari ro'yxatning pastida yoki 50 chegarasidan tashqarida
   * qolgan edi.
   *
   * `COALESCE` bekor qilinganlar uchun yaratilgan vaqtni oladi — bu ilovada
   * ko'rsatilayotgan sana bilan bir xil (`completedAt ?? createdAt`).
   */
  tripHistory(driverId: string): Promise<Order[]> {
    return this.orders
      .createQueryBuilder('o')
      .where('o.driver_id = :driverId AND o.status IN (:...st)', {
        driverId,
        st: FINISHED_STATUSES,
      })
      .orderBy('COALESCE(o.completed_at, o.created_at)', 'DESC')
      .take(50)
      .getMany();
  }

  /**
   * Haydovchi ko'rsatkichlari. Reyting/metrikalar `drivers` jadvalida saqlanadi
   * (ReputationService har baho va safardan keyin qayta hisoblaydi).
   */
  async stats(driverId: string): Promise<{
    ratingAvg: number;
    acceptanceRate: number;
    cancelRate: number;
    completionRate: number;
    totalTrips: number;
    earnedTotal: number;
  }> {
    const d = await this.mustFind(driverId);
    const agg = await this.orders
      .createQueryBuilder('o')
      .select('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(o.final_price), 0)', 'sum')
      .where('o.driver_id = :id AND o.status = :st', { id: driverId, st: OrderStatus.COMPLETED })
      .getRawOne<{ cnt: string; sum: string }>();
    return {
      ratingAvg: d.ratingAvg,
      acceptanceRate: d.acceptanceRate,
      cancelRate: d.cancelRate,
      completionRate: d.completionRate,
      totalTrips: Number(agg?.cnt ?? 0),
      earnedTotal: Number(agg?.sum ?? 0),
    };
  }

  private async mustFind(id: string): Promise<Driver> {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Haydovchi topilmadi');
    return driver;
  }
}
