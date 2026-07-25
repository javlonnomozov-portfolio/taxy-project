import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ApprovalStatus, DriverStatus, VehicleCategory } from '@tty/shared';
import { SOCKET_EVENTS } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { GeoService } from '../geo/geo.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Driver } from '../entities/driver.entity';
import { Vehicle } from '../entities/vehicle.entity';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly geo: GeoService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
  ) {}

  private catKey(driverId: string): string {
    return `driver:cat:${driverId}`;
  }

  async register(
    driverId: string,
    data: {
      firstName?: string;
      lastName?: string;
      vehicle: { make?: string; model?: string; color?: string; plate?: string; category: VehicleCategory };
    },
  ): Promise<Driver> {
    const driver = await this.mustFind(driverId);
    driver.firstName = data.firstName ?? driver.firstName;
    driver.lastName = data.lastName ?? driver.lastName;
    // Dev qulaylik: production'da KYC tasdig'i operator orqali (2.11).
    if (this.config.get('NODE_ENV') !== 'production') {
      driver.approvalStatus = ApprovalStatus.APPROVED;
    }
    await this.drivers.save(driver);

    let vehicle = await this.vehicles.findOne({ where: { driverId } });
    vehicle = vehicle ?? this.vehicles.create({ driverId });
    Object.assign(vehicle, data.vehicle);
    await this.vehicles.save(vehicle);
    return driver;
  }

  async approve(driverId: string): Promise<Driver> {
    const driver = await this.mustFind(driverId);
    driver.approvalStatus = ApprovalStatus.APPROVED;
    return this.drivers.save(driver);
  }

  async block(driverId: string): Promise<Driver> {
    const driver = await this.mustFind(driverId);
    driver.approvalStatus = ApprovalStatus.BLOCKED;
    driver.status = DriverStatus.OFFLINE;
    await this.geo.removeFromAll(driverId);
    return this.drivers.save(driver);
  }

  listAll(): Promise<Driver[]> {
    return this.drivers.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async setBilling(driverId: string, mode: string, config?: Record<string, unknown>): Promise<Driver> {
    const driver = await this.mustFind(driverId);
    driver.billingMode = mode as Driver['billingMode'];
    if (config) driver.billingConfig = config;
    return this.drivers.save(driver);
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
    await this.getCategory(driverId);
  }

  async goOffline(driverId: string): Promise<void> {
    await this.drivers.update(driverId, { status: DriverStatus.OFFLINE });
    await this.geo.removeFromAll(driverId);
  }

  async updateLocation(driverId: string, lat: number, lng: number): Promise<void> {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (!driver || driver.status !== DriverStatus.ONLINE_IDLE) return;
    const category = await this.getCategory(driverId);
    await this.geo.setDriverLocation(driverId, category, lng, lat);
    await this.drivers.update(driverId, { lastSeenAt: new Date() });
    // Operator jonli xaritasi uchun.
    this.realtime.emitToOps(SOCKET_EVENTS.ops.driverUpdate, {
      driverId,
      lat,
      lng,
      status: driver.status,
      category,
    });
  }

  /** Dispatch biriktirgach — band, geo-indeksdan chiqadi. */
  async markOnTrip(driverId: string): Promise<void> {
    await this.drivers.update(driverId, { status: DriverStatus.ON_TRIP });
    await this.geo.removeFromAll(driverId);
  }

  /** Safar tugagach yoki bekor bo'lgach — yana bo'sh. */
  async markIdle(driverId: string): Promise<void> {
    await this.drivers.update(driverId, { status: DriverStatus.ONLINE_IDLE });
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

  private async mustFind(id: string): Promise<Driver> {
    const driver = await this.drivers.findOne({ where: { id } });
    if (!driver) throw new NotFoundException('Haydovchi topilmadi');
    return driver;
  }
}
