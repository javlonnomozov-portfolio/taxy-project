import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Push abstraktsiyasi. Hozircha stub (log). Real FCM provayder keyin ulanadi:
// FCM_SERVER_KEY bo'lsa haqiqiy yuborish, aks holda faqat log (dev).
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  async pushToDriver(driverId: string, title: string, body: string): Promise<void> {
    const fcmKey = this.config.get<string>('FCM_SERVER_KEY');
    if (!fcmKey) {
      this.log.debug(`[push→driver ${driverId}] ${title}: ${body} (stub, FCM sozlanmagan)`);
      return;
    }
    // TODO: FCM HTTP v1 orqali yuborish (driver device token kerak).
    this.log.debug(`[push→driver ${driverId}] ${title} (FCM)`);
  }
}
