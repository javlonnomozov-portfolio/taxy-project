import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import Redis from 'ioredis';
import { OrderStatus } from '@tty/shared';
import { REDIS } from '../redis/redis.module';
import { RealtimeService } from '../realtime/realtime.service';
import { ChatKind, ChatSender, DriverMessage } from '../entities/driver-message.entity';
import { ChatMedia } from '../entities/chat-media.entity';
import { Driver } from '../entities/driver.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Order } from '../entities/order.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { ACTIVE_STATUSES } from '../orders/orders.constants';
import { MAX_TEXT_LEN, MAX_VOICE_SEC, MediaKind, checkMedia } from './chat.media';

/** Soket hodisalari — haydovchi xonasiga ham, `ops` xonasiga ham boradi. */
export const CHAT_EVENTS = {
  message: 'chat:message',
  read: 'chat:read',
} as const;

/** Multer xotira fayli — `@types/multer` bog'liqligini qo'shmaslik uchun o'z tipimiz. */
export interface UploadedMedia {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

export interface MessageView {
  id: string;
  driverId: string;
  sender: ChatSender;
  kind: ChatKind;
  body: string | null;
  mediaId: string | null;
  durationSec: number | null;
  authorLogin: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Kim yozyapti: haydovchi o'zi yoki panel akkaunti. */
export type ChatActor = { sender: 'driver' } | { sender: 'ops'; adminId: string };

/** Bir daqiqada bitta tomondan eng ko'pi. Tasodifiy tugma bosilishi/skript chatni ko'mmasin. */
const RATE_PER_MIN = 20;

/** Toshkent/Samarqand vaqti (UTC+5, yozgi vaqt yo'q) — "bugun" shu bo'yicha. */
const TZ_OFFSET_MS = 5 * 3600_000;

@Injectable()
export class ChatService {
  private readonly log = new Logger(ChatService.name);

  constructor(
    @InjectRepository(DriverMessage) private readonly messages: Repository<DriverMessage>,
    @InjectRepository(ChatMedia) private readonly mediaRepo: Repository<ChatMedia>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly realtime: RealtimeService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ yozish

  async sendText(driverId: string, actor: ChatActor, body: string): Promise<MessageView> {
    const text = (body ?? '').trim();
    if (!text) throw new BadRequestException('Xabar bo‘sh');
    if (text.length > MAX_TEXT_LEN) throw new BadRequestException('Xabar juda uzun');

    const author = await this.prepare(driverId, actor);
    const saved = await this.messages.save(
      this.messages.create({ driverId, sender: actor.sender, kind: 'text', body: text, ...author }),
    );
    return this.publish(saved);
  }

  async sendMedia(
    driverId: string,
    actor: ChatActor,
    kind: MediaKind,
    file: UploadedMedia | undefined,
    durationSec?: number,
  ): Promise<MessageView> {
    const check = checkMedia(file?.buffer, kind);
    if (!check.ok) throw new BadRequestException(check.reason);
    if (kind === 'voice' && durationSec != null && (durationSec < 1 || durationSec > MAX_VOICE_SEC)) {
      throw new BadRequestException(`Ovozli xabar ${MAX_VOICE_SEC} soniyadan oshmasin`);
    }

    const author = await this.prepare(driverId, actor);
    // Media va xabar BIRGA yoziladi: yarim yo'lda uzilsa egasiz bayt qolmasin.
    const saved = await this.dataSource.transaction(async (m) => {
      const media = await m.save(
        m.create(ChatMedia, { mime: check.mime, sizeBytes: file!.buffer.length, data: file!.buffer }),
      );
      return m.save(
        m.create(DriverMessage, {
          driverId,
          sender: actor.sender,
          kind,
          mediaId: media.id,
          durationSec: kind === 'voice' ? (durationSec ?? null) : null,
          ...author,
        }),
      );
    });
    return this.publish(saved);
  }

  /** Qarshi tomon xabarlarini o'qildi deb belgilaydi. */
  async markRead(driverId: string, reader: ChatSender): Promise<{ updated: number }> {
    const other: ChatSender = reader === 'driver' ? 'ops' : 'driver';
    const res = await this.messages
      .createQueryBuilder()
      .update(DriverMessage)
      .set({ readAt: () => 'now()' })
      .where('driver_id = :driverId AND sender = :other AND read_at IS NULL', { driverId, other })
      .execute();
    const updated = res.affected ?? 0;
    if (updated > 0) {
      const payload = { driverId, reader, at: new Date().toISOString() };
      this.realtime.emitToDriver(driverId, CHAT_EVENTS.read, payload);
      this.realtime.emitToOps(CHAT_EVENTS.read, payload);
    }
    return { updated };
  }

  // ------------------------------------------------------------------ o'qish

  /** Suhbat — eskidan yangiga. `before` bilan orqaga sahifalanadi. */
  async list(driverId: string, before?: string, limit = 50): Promise<MessageView[]> {
    const rows = await this.messages.find({
      where: { driverId, ...(before ? { createdAt: LessThan(new Date(before)) } : {}) },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.reverse().map((m) => this.toView(m));
  }

  /** Haydovchi uchun: paneldan kelgan o'qilmagan xabarlar soni (ilovadagi nishon). */
  async unreadForDriver(driverId: string): Promise<{ unread: number }> {
    // `IS NULL` so'rov quruvchida: `find({ readAt: undefined })` shartni jimgina
    // TASHLAB yuboradi va o'qilganlarni ham sanardi.
    const unread = await this.messages
      .createQueryBuilder('m')
      .where('m.driver_id = :driverId AND m.sender = :s AND m.read_at IS NULL', { driverId, s: 'ops' })
      .getCount();
    return { unread };
  }

  /**
   * Panel ro'yxati: har haydovchi bilan so'nggi xabar va o'qilmaganlar soni,
   * eng yangi suhbat birinchi.
   */
  async conversations(): Promise<
    Array<{
      driverId: string;
      name: string;
      phone: string;
      status: string;
      lastKind: ChatKind;
      lastBody: string | null;
      lastSender: ChatSender;
      lastAt: string;
      unread: number;
    }>
  > {
    const last: Array<{ driver_id: string; kind: ChatKind; body: string | null; sender: ChatSender; created_at: Date }> =
      await this.dataSource.query(
        `SELECT DISTINCT ON (driver_id) driver_id, kind, body, sender, created_at
         FROM driver_messages
         ORDER BY driver_id, created_at DESC`,
      );
    if (last.length === 0) return [];

    const unreadRows: Array<{ driver_id: string; n: number }> = await this.dataSource.query(
      `SELECT driver_id, count(*)::int AS n FROM driver_messages
       WHERE sender = 'driver' AND read_at IS NULL GROUP BY driver_id`,
    );
    const unread = new Map(unreadRows.map((r) => [r.driver_id, r.n]));
    const drivers = await this.drivers.find({ where: { id: In(last.map((l) => l.driver_id)) } });
    const byId = new Map(drivers.map((d) => [d.id, d]));

    return last
      .map((l) => {
        const d = byId.get(l.driver_id);
        return {
          driverId: l.driver_id,
          name: d ? [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Haydovchi' : 'Haydovchi',
          phone: d?.phone ?? '',
          status: d?.status ?? 'OFFLINE',
          lastKind: l.kind,
          lastBody: l.body,
          lastSender: l.sender,
          lastAt: new Date(l.created_at).toISOString(),
          unread: unread.get(l.driver_id) ?? 0,
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }

  /**
   * Fayl baytlari. Haydovchi FAQAT o'z suhbatidagi faylni oladi; boshqasiniki
   * so'ralsa 404 (403 emas — fayl mavjudligini ham oshkor qilmaymiz).
   */
  async media(mediaId: string, viewerDriverId?: string): Promise<{ mime: string; data: Buffer }> {
    const msg = await this.messages.findOne({ where: { mediaId } });
    if (!msg || (viewerDriverId && msg.driverId !== viewerDriverId)) {
      throw new NotFoundException('Fayl topilmadi');
    }
    const media = await this.mediaRepo
      .createQueryBuilder('m')
      .addSelect('m.data')
      .where('m.id = :id', { id: mediaId })
      .getOne();
    if (!media) throw new NotFoundException('Fayl topilmadi');
    return { mime: media.mime, data: media.data };
  }

  /**
   * Xaritada haydovchi bosilganda ochiladigan oyna uchun: holat, reyting,
   * mashina, bugungi ish va faol zakaz — bitta so'rovda.
   */
  async driverSummary(driverId: string) {
    const d = await this.drivers.findOne({ where: { id: driverId } });
    if (!d) throw new NotFoundException('Haydovchi topilmadi');
    const v = await this.vehicles.findOne({ where: { driverId } });

    const now = Date.now();
    const local = new Date(now + TZ_OFFSET_MS);
    local.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(local.getTime() - TZ_OFFSET_MS);

    const today = await this.orders
      .createQueryBuilder('o')
      .select('COUNT(*)::int', 'trips')
      .addSelect('COALESCE(SUM(o.final_price), 0)', 'earned')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :st', { st: OrderStatus.COMPLETED })
      .andWhere('o.completed_at >= :from', { from: startOfToday })
      .getRawOne<{ trips: number; earned: string }>();

    const active = await this.orders.findOne({
      where: { driverId, status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
    });
    const unread = await this.messages
      .createQueryBuilder('m')
      .where('m.driver_id = :driverId AND m.sender = :s AND m.read_at IS NULL', { driverId, s: 'driver' })
      .getCount();

    return {
      driverId: d.id,
      name: [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Haydovchi',
      phone: d.phone,
      status: d.status,
      approvalStatus: d.approvalStatus,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      ratingAvg: Number(d.ratingAvg) || 0,
      cancelRate: Number(d.cancelRate) || 0,
      acceptanceRate: Number(d.acceptanceRate) || 0,
      completionRate: Number(d.completionRate) || 0,
      balance: Number(d.balance) || 0,
      vehicle: v
        ? {
            category: v.category,
            car: [v.color, v.make, v.model].filter(Boolean).join(' '),
            plate: v.plate,
            seats: v.seats,
          }
        : null,
      tripsToday: Number(today?.trips) || 0,
      earnedToday: Number(today?.earned) || 0,
      activeOrder: active
        ? { id: active.id, status: active.status, category: active.vehicleCategory }
        : null,
      unread,
    };
  }

  // ---------------------------------------------------------------- ichki

  /** Haydovchi mavjudligi, tezlik chegarasi va panel muallifi. */
  private async prepare(
    driverId: string,
    actor: ChatActor,
  ): Promise<{ authorId: string | null; authorLogin: string | null }> {
    if (actor.sender === 'ops') {
      const exists = await this.drivers.exist({ where: { id: driverId } });
      if (!exists) throw new NotFoundException('Haydovchi topilmadi');
    }
    await this.rateLimit(actor.sender === 'driver' ? `d:${driverId}` : `o:${actor.adminId}`);

    if (actor.sender === 'driver') return { authorId: null, authorLogin: null };
    const admin = await this.admins.findOne({ where: { id: actor.adminId } });
    return { authorId: actor.adminId, authorLogin: admin?.login ?? null };
  }

  private async rateLimit(key: string): Promise<void> {
    const bucket = `chat:rl:${key}:${Math.floor(Date.now() / 60_000)}`;
    const n = await this.redis.incr(bucket);
    if (n === 1) await this.redis.expire(bucket, 70);
    if (n > RATE_PER_MIN) {
      throw new HttpException('Juda ko‘p xabar — bir daqiqadan keyin yozing', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private publish(m: DriverMessage): MessageView {
    const view = this.toView(m);
    this.realtime.emitToDriver(m.driverId, CHAT_EVENTS.message, view);
    this.realtime.emitToOps(CHAT_EVENTS.message, view);
    this.log.log(`Chat: ${m.sender} -> haydovchi ${m.driverId} (${m.kind})`);
    return view;
  }

  private toView(m: DriverMessage): MessageView {
    return {
      id: m.id,
      driverId: m.driverId,
      sender: m.sender,
      kind: m.kind,
      body: m.body,
      mediaId: m.mediaId,
      durationSec: m.durationSec,
      authorLogin: m.authorLogin,
      readAt: m.readAt ? new Date(m.readAt).toISOString() : null,
      createdAt: new Date(m.createdAt).toISOString(),
    };
  }
}
