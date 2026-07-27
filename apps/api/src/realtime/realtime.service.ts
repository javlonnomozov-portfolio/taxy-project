import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

// Gateway'lar o'z Server'larini shu yerga ro'yxatdan o'tkazadi.
// Dispatch va boshqa servislar shu orqali emit qiladi (gateway'ga to'g'ridan bog'lanmasdan).
@Injectable()
export class RealtimeService {
  private driverServer?: Server;
  private customerServer?: Server;
  private opsServer?: Server;

  registerDriverServer(s: Server) {
    this.driverServer = s;
  }
  registerCustomerServer(s: Server) {
    this.customerServer = s;
  }
  registerOpsServer(s: Server) {
    this.opsServer = s;
  }

  emitToDriver(driverId: string, event: string, payload: unknown) {
    this.driverServer?.to(`driver:${driverId}`).emit(event, payload);
  }

  emitToCustomer(customerId: string, event: string, payload: unknown) {
    this.customerServer?.to(`customer:${customerId}`).emit(event, payload);
  }

  emitToOps(event: string, payload: unknown) {
    this.opsServer?.to('ops').emit(event, payload);
  }

  /**
   * Haydovchining barcha socketlarini majburan uzish (bloklanganda).
   * Faqat HTTP guard'ini tekshirish yetarli emas — allaqachon ochilgan socket
   * ulanish tekshiruvdan o'tib bo'lgan va zakaz qabul qilishda davom etardi.
   */
  async disconnectDriver(driverId: string, reason = 'blocked'): Promise<void> {
    const server = this.driverServer;
    if (!server) return;
    const sockets = await server.in(`driver:${driverId}`).fetchSockets();
    for (const s of sockets) {
      s.emit('session:revoked', { reason });
      s.disconnect(true);
    }
  }
}
