import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActorType } from '@tty/shared';
import { OrderEvent } from '../entities/order-event.entity';

@Injectable()
export class OrderEventsService {
  constructor(@InjectRepository(OrderEvent) private readonly repo: Repository<OrderEvent>) {}

  record(
    orderId: string,
    type: string,
    actor: ActorType,
    opts: { actorId?: string; reason?: string; payload?: Record<string, unknown> } = {},
  ): Promise<OrderEvent> {
    return this.repo.save(
      this.repo.create({
        orderId,
        type,
        actor,
        actorId: opts.actorId ?? null,
        reason: opts.reason ?? null,
        payload: opts.payload ?? null,
      }),
    );
  }
}
