import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

/** Tozalash oralig'i — soatiga bir marta yetarli (muddat kunlarda o'lchanadi). */
const EVERY_MS = 60 * 60_000;
/** Ishga tushgach birinchi tozalash — migratsiya va ulanishlar tinchigach. */
const FIRST_RUN_MS = 30_000;

/**
 * Chat xabarlarini muddati o'tgach o'chirish (sukut: 3 kun).
 *
 * NEGA: rasm va ovozli xabarlar Postgres ichida (`chat_media`, bytea) saqlanadi
 * va bazani tez to'ldiradi (foydalanuvchi qarori: joy kattagina). Chat tezkor
 * muloqot uchun — eski yozishmalar kerak emas.
 *
 * Xabar va uning fayli BITTA SQL'da o'chadi (data-modifying CTE): avval
 * `driver_messages`, keyin shu xabarlarning `chat_media` qatorlari. FK tekshiruvi
 * statement oxirida bo'ladi, ya'ni egasiz fayl ham, faylsiz xabar ham qolmaydi.
 *
 * Bir nechta instansiyada ham xavfsiz: DELETE takror bajarilsa shunchaki 0 qator.
 *
 * DISK: o'chirilgan joy Postgres ichida qayta ishlatiladi (autovacuum), lekin
 * operatsion tizimga darhol qaytmaydi — bu normal.
 */
@Injectable()
export class ChatRetentionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(ChatRetentionService.name);
  private readonly days: number;
  private first?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const raw = Number(config.get<string>('CHAT_RETENTION_DAYS') ?? 3);
    // Noto'g'ri qiymat (0, manfiy, matn) butun chatni o'chirib yubormasin.
    this.days = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 3;
  }

  onApplicationBootstrap(): void {
    const run = () => void this.purge().catch((e) => this.log.warn(`Chat tozalash xato: ${(e as Error).message}`));
    this.first = setTimeout(run, FIRST_RUN_MS);
    this.timer = setInterval(run, EVERY_MS);
    // Taymerlar jarayonni tirik ushlab turmasin (testlar, to'xtatish).
    this.first.unref();
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  /** Muddati o'tgan xabarlar va ularning fayllarini o'chiradi. */
  async purge(): Promise<{ messages: number; media: number }> {
    const rows: Array<{ messages: number; media: number }> = await this.dataSource.query(
      `WITH gone AS (
         DELETE FROM driver_messages
         WHERE created_at < now() - make_interval(days => $1)
         RETURNING media_id
       ), media AS (
         DELETE FROM chat_media
         WHERE id IN (SELECT media_id FROM gone WHERE media_id IS NOT NULL)
         RETURNING id
       )
       SELECT (SELECT count(*) FROM gone)::int AS messages,
              (SELECT count(*) FROM media)::int AS media`,
      [this.days],
    );
    const res = rows[0] ?? { messages: 0, media: 0 };
    if (res.messages > 0) {
      this.log.log(`Chat tozalandi: ${res.messages} xabar, ${res.media} fayl (${this.days} kundan eski)`);
    }
    return res;
  }
}
