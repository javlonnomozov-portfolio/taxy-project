import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Expo Push orqali (Expo o'zi FCM/APNs'ga uzatadi — backendda FCM kaliti shart emas).
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(@InjectRepository(Driver) private readonly drivers: Repository<Driver>) {}

  async pushToDriver(
    driverId: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    const token = driver?.pushToken;
    if (!token) return; // token yo'q — ilova push'siz (foreground socket bilan ishlaydi)
    await this.sendExpo(token, title, body, data);
  }

  private async sendExpo(
    to: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify([
          { to, title, body, data, sound: 'default', priority: 'high', channelId: 'orders' },
        ]),
      });
      if (!res.ok) {
        this.log.warn(`Expo push xato: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      this.log.warn(`Expo push yuborilmadi: ${(e as Error).message}`);
    }
  }
}
