import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';
import { corsOptions } from '../config/cors';

/**
 * Socket.IO adapteri: CORS + Redis pub/sub.
 *
 * CORS — HTTP bilan bir xil qoida, bitta joydan. Avval har gateway dekoratorida
 * `cors: { origin: '*' }` yozilgan edi, ya'ni istalgan sayt brauzerdan socketga
 * ulana olardi. Gateway dekoratori env'ni o'qiy olmaydi (u modul yuklanganda
 * hisoblanadi), shuning uchun qoida adapter darajasiga ko'chirildi.
 *
 * REDIS ADAPTER — `emitToDriver(...)` va `fetchSockets()` BARCHA instansiyalarda
 * ishlashi uchun. Busiz ikkinchi instansiya qo'shilsa, 1-instansiyaga ulangan
 * haydovchi 2-instansiya yuborgan taklifni umuman olmasdi.
 */
export class CorsSocketAdapter extends IoAdapter {
  private static readonly log = new Logger(CorsSocketAdapter.name);
  private adapterFactory?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly origins: string[] | null,
  ) {
    super(app);
  }

  /**
   * Pub/sub uchun ALOHIDA ulanishlar kerak — ioredis'da subscriber rejimidagi
   * ulanish oddiy buyruqlarni bajara olmaydi, shuning uchun ilovaning asosiy
   * Redis ulanishini qayta ishlatib bo'lmaydi.
   */
  async connectToRedis(redisUrl: string): Promise<void> {
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.ping(), subClient.ping()]);
    this.clients = [pubClient, subClient];
    this.adapterFactory = createAdapter(pubClient, subClient);
    CorsSocketAdapter.log.log('Socket.IO Redis adapteri ulandi');
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: corsOptions(this.origins),
    }) as { adapter: (a: unknown) => void };
    if (this.adapterFactory) server.adapter(this.adapterFactory);
    return server;
  }

  async close(): Promise<void> {
    await Promise.all(this.clients.map((c) => c.quit().catch(() => {})));
  }
}
