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
}
