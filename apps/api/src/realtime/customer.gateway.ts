import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

// Mijoz kanali. Ishlab chiqarishda bot backend proksi qiladi; Sprint 1'da
// mijoz customerId + ichki kalit bilan ulanadi (jonli status olish uchun).
@WebSocketGateway({ namespace: '/customer', cors: { origin: '*' } })
export class CustomerGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.registerCustomerServer(server);
  }

  async handleConnection(client: Socket) {
    const key = client.handshake.auth?.internalKey as string | undefined;
    const customerId = client.handshake.auth?.customerId as string | undefined;
    if (!customerId || key !== this.config.get<string>('INTERNAL_API_KEY')) {
      client.disconnect(true);
      return;
    }
    await client.join(`customer:${customerId}`);
  }
}
