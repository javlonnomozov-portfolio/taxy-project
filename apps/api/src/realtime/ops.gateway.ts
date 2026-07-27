import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PanelRole } from '@tty/shared';
import { JwtPayload } from '../auth/roles';
import { RealtimeService } from './realtime.service';

const PANEL_ROLES: string[] = [PanelRole.SUPER_ADMIN, PanelRole.ADMIN, PanelRole.OPERATOR];

// CORS markazlashgan: main.ts dagi CorsSocketAdapter (CORS_ORIGINS env).
@WebSocketGateway({ namespace: '/ops' })
export class OpsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.registerOpsServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const payload = await this.jwt.verifyAsync<JwtPayload>(token ?? '');
      if (!PANEL_ROLES.includes(payload.role)) throw new Error('rol');
      await client.join('ops');
    } catch {
      client.disconnect(true);
    }
  }
}
