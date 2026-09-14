import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';
import { AccountStatusService } from '../auth/account-status.service';
import { JwtPayload } from '../auth/roles';

// Mijoz kanali. Ishlab chiqarishda bot backend proksi qiladi; Sprint 1'da
// mijoz customerId + ichki kalit bilan ulanadi (jonli status olish uchun).
// CORS markazlashgan: main.ts dagi CorsSocketAdapter (CORS_ORIGINS env).
@WebSocketGateway({ namespace: '/customer' })
export class CustomerGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly accounts: AccountStatusService,
  ) {}

  afterInit(server: Server) {
    this.realtime.registerCustomerServer(server);
  }

  /**
   * Ikki xil ulanish:
   *
   * 1. MOBIL ILOVA — mijoz JWT'si (`auth.token`). Ilovaga INTERNAL_API_KEY
   *    berib BO'LMAYDI: u butun ichki API'ni ochadi va APK ichidan chiqarib
   *    olinadi. Shuning uchun ilova uchun alohida yo'l qo'shildi (2026-09-14).
   * 2. BOT BACKEND — ichki kalit + `customerId` (eski yo'l, o'zgarmadi):
   *    u serverda ishlaydi va mijoz tokeniga ega emas.
   */
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token);
        if (payload.role !== 'customer') throw new Error('rol');
        // Token 7 kun yashaydi — hisob orada bloklangan bo'lishi mumkin.
        if (!(await this.accounts.isActive('customer', payload.sub))) throw new Error('bloklangan');
        await client.join(`customer:${payload.sub}`);
        return;
      } catch {
        client.disconnect(true);
        return;
      }
    }

    const key = client.handshake.auth?.internalKey as string | undefined;
    const customerId = client.handshake.auth?.customerId as string | undefined;
    if (!customerId || key !== this.config.get<string>('INTERNAL_API_KEY')) {
      client.disconnect(true);
      return;
    }
    await client.join(`customer:${customerId}`);
  }
}
