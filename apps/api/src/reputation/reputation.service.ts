import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating, RatingDirection } from '../entities/rating.entity';
import { Order } from '../entities/order.entity';
import { Driver } from '../entities/driver.entity';
import { Customer } from '../entities/customer.entity';
import { OrderEvent } from '../entities/order-event.entity';

@Injectable()
export class ReputationService {
  constructor(
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(OrderEvent) private readonly events: Repository<OrderEvent>,
  ) {}

  private avg(scores: Record<string, number>): number {
    const vals = Object.values(scores).filter((v) => typeof v === 'number');
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  /** Baho yozish (ikki tomonlama, ixtiyoriy). Har yo'nalish uchun bitta. */
  async submit(
    orderId: string,
    direction: RatingDirection,
    scores: Record<string, number>,
    comment?: string,
  ): Promise<Rating> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (!order.driverId) throw new BadRequestException('Buyurtmada haydovchi yo‘q');
    for (const v of Object.values(scores)) {
      if (v < 1 || v > 5) throw new BadRequestException('Baho 1..5 oralig‘ida bo‘lishi kerak');
    }

    const overall = this.avg(scores);
    const rating = await this.ratings.save(
      this.ratings.create({
        orderId,
        direction,
        driverId: order.driverId,
        customerId: order.customerId,
        scores,
        overall,
        comment: comment ?? null,
      }),
    );

    if (direction === 'customer_to_driver') await this.recomputeDriver(order.driverId);
    else await this.recomputeCustomer(order.customerId);
    return rating;
  }

  /** Haydovchi reytingi + xulq metrikalari (2.8). */
  async recomputeDriver(driverId: string): Promise<void> {
    const row = await this.ratings
      .createQueryBuilder('r')
      .select('AVG(r.overall)', 'avg')
      .where('r.driver_id = :driverId AND r.direction = :dir', {
        driverId,
        dir: 'customer_to_driver',
      })
      .getRawOne<{ avg: string | null }>();
    const avg = row?.avg ?? null;

    const counts = await this.driverEventCounts(driverId);
    const acceptDenom = counts.accepted + counts.declined;
    const acceptanceRate = acceptDenom ? (counts.accepted / acceptDenom) * 100 : 0;
    const cancelRate = counts.accepted ? (counts.driverCancels / counts.accepted) * 100 : 0;
    const completionRate = counts.accepted ? (counts.completed / counts.accepted) * 100 : 0;

    await this.drivers.update(driverId, {
      ratingAvg: avg ? Math.round(Number(avg) * 100) / 100 : 0,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      cancelRate: Math.round(cancelRate * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
    });
  }

  async recomputeCustomer(customerId: string): Promise<void> {
    const row = await this.ratings
      .createQueryBuilder('r')
      .select('AVG(r.overall)', 'avg')
      .where('r.customer_id = :customerId AND r.direction = :dir', {
        customerId,
        dir: 'driver_to_customer',
      })
      .getRawOne<{ avg: string | null }>();
    const avg = row?.avg ?? null;
    await this.customers.update(customerId, {
      ratingAvg: avg ? Math.round(Number(avg) * 100) / 100 : 0,
    });
  }

  private async driverEventCounts(driverId: string) {
    const rows = await this.events
      .createQueryBuilder('e')
      .select('e.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('e.actor_id = :driverId AND e.actor = :actor', { driverId, actor: 'driver' })
      .groupBy('e.type')
      .getRawMany<{ type: string; count: string }>();
    const map = Object.fromEntries(rows.map((r) => [r.type, Number(r.count)]));
    return {
      accepted: map['accepted'] ?? 0,
      declined: map['declined'] ?? 0,
      completed: map['completed'] ?? 0,
      driverCancels: map['cancelled'] ?? 0,
    };
  }

  /** Reyting past yoki bekor darajasi yuqori bo'lsa flag (operator uchun). */
  async isFlagged(driverId: string): Promise<boolean> {
    const d = await this.drivers.findOne({ where: { id: driverId } });
    if (!d) return false;
    return Number(d.ratingAvg) > 0 && (Number(d.ratingAvg) < 3.5 || Number(d.cancelRate) > 30);
  }
}
