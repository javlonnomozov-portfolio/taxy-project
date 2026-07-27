import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { corsOptions } from '../config/cors';

/**
 * Socket.IO uchun CORS'ni bitta joydan boshqaradi (HTTP bilan bir xil qoida).
 *
 * Avval har gateway dekoratorida `cors: { origin: '*' }` yozilgan edi — ya'ni
 * istalgan sayt brauzerdan socketga ulana olardi. Gateway dekoratori env'ni
 * o'qiy olmaydi (dekorator modul yuklanganda hisoblanadi), shuning uchun
 * qoidani adapter darajasiga ko'chirdik.
 */
export class CorsSocketAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[] | null,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, { ...options, cors: corsOptions(this.origins) });
  }
}
