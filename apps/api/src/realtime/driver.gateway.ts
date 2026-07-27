import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@tty/shared';
import { ActorType } from '@tty/shared';
import { JwtPayload } from '../auth/roles';
import { DriversService } from '../drivers/drivers.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { TripsService } from '../trips/trips.service';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({ namespace: '/driver', cors: { origin: '*' } })
export class DriverGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(DriverGateway.name);
  @WebSocketServer() server!: Server;

  // Socket uzilishida darhol oflayn qilmaymiz — qisqa uzilishlar (ilova foni,
  // tarmoq) uchun grace. Shu vaqt ichida qayta ulansa, oflayn bekor qilinadi.
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();
  private readonly OFFLINE_GRACE_MS = 120_000; // taklif oynasi (2 daq) davomida onlayn qoladi

  constructor(
    private readonly jwt: JwtService,
    private readonly drivers: DriversService,
    private readonly dispatch: DispatchService,
    private readonly trips: TripsService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.registerDriverServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const payload = await this.jwt.verifyAsync<JwtPayload>(token ?? '');
      if (payload.role !== 'driver') throw new Error('rol');
      client.data.driverId = payload.sub;
      await client.join(`driver:${payload.sub}`);
      // Qayta ulandi — kutilayotgan oflayn taymerini bekor qilamiz.
      const pending = this.offlineTimers.get(payload.sub);
      if (pending) {
        clearTimeout(pending);
        this.offlineTimers.delete(payload.sub);
      }
      // Fondan qaytган bo'lsa — hali kutilayotgan taklifni qayta ko'rsatamiz.
      await this.dispatch.resendActiveOffer(payload.sub);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const driverId = client.data.driverId as string | undefined;
    if (!driverId) return;
    // Shu haydovchining boshqa (yangi) ulanishi bormi? Bo'lsa — oflayn qilmaymiz.
    const sockets = await this.server.in(`driver:${driverId}`).fetchSockets();
    if (sockets.length > 0) return;
    // Grace: qisqa uzilish bo'lsa qayta ulanishiga imkon beramiz.
    const existing = this.offlineTimers.get(driverId);
    if (existing) clearTimeout(existing);
    this.offlineTimers.set(
      driverId,
      setTimeout(() => {
        this.offlineTimers.delete(driverId);
        void this.drivers.goOffline(driverId);
      }, this.OFFLINE_GRACE_MS),
    );
  }

  private driverId(client: Socket): string {
    return client.data.driverId as string;
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.online)
  async online(client: Socket) {
    await this.drivers.goOnline(this.driverId(client));
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.offline)
  async offline(client: Socket) {
    await this.drivers.goOffline(this.driverId(client));
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.location)
  async location(client: Socket, data: { lat: number; lng: number }) {
    await this.drivers.updateLocation(this.driverId(client), data.lat, data.lng);
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.offerResponse)
  async offerResponse(client: Socket, data: { orderId: string; accept: boolean }) {
    await this.dispatch.handleResponse(data.orderId, this.driverId(client), data.accept);
  }

  // ---- Safar bosqichlari ----

  @SubscribeMessage(SOCKET_EVENTS.driver.tripConfirm)
  async confirm(client: Socket, data: { orderId: string }) {
    await this.trips.confirm(data.orderId, this.driverId(client));
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.tripArrived)
  async arrived(client: Socket, data: { orderId: string }) {
    await this.trips.arrived(data.orderId, this.driverId(client));
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.tripStart)
  async start(client: Socket, data: { orderId: string }) {
    await this.trips.start(data.orderId, this.driverId(client));
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.tripComplete)
  async complete(client: Socket, data: { orderId: string; distanceM: number }) {
    return this.trips.complete(data.orderId, this.driverId(client), data.distanceM);
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.tripNoShow)
  async noShow(client: Socket, data: { orderId: string }) {
    return this.trips.noShow(data.orderId, this.driverId(client));
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.tripCancel)
  async cancel(client: Socket, data: { orderId: string; reason?: string }) {
    await this.trips.cancelByDriver(data.orderId, this.driverId(client), data.reason);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.tripTrackSync)
  async trackSync(client: Socket, data: { orderId: string; points: Array<{ lat: number; lng: number; at: string }> }) {
    await this.trips.addTrack(data.orderId, this.driverId(client), data.points);
    return { ok: true };
  }

  @SubscribeMessage(SOCKET_EVENTS.driver.sos)
  async sos(client: Socket, data: { orderId?: string }) {
    await this.trips.sos(data.orderId ?? null, ActorType.DRIVER, this.driverId(client));
    return { ok: true };
  }
}
