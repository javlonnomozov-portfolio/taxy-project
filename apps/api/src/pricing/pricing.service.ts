import { Injectable } from '@nestjs/common';
import { VehicleCategory } from '@tty/shared';
import { SettingsService } from '../settings/settings.service';
import { Tariff } from '../entities/tariff.entity';

export interface FareBreakdown {
  base: number;
  distance: number;
  waiting: number;
  subtotal: number;
  nightMultiplier: number;
  surgeMultiplier: number;
  total: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly settings: SettingsService) {}

  /** "hh:mm" → daqiqa (00:00 dan). */
  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Vaqt tungi oraliqda ekanini tekshirish (yarim tunni o'rab o'tishni hisobga oladi). */
  isNight(tariff: Tariff, when: Date): boolean {
    const now = when.getHours() * 60 + when.getMinutes();
    const from = this.toMinutes(tariff.nightFrom);
    const to = this.toMinutes(tariff.nightTo);
    return from <= to ? now >= from && now < to : now >= from || now < to;
  }

  /**
   * Taksometr hisobi (2.5): base + km*narx + kutish haqi, so'ng tungi va surge koeffitsienti.
   * Kutish haqi faqat bepul daqiqalardan oshgan qism uchun.
   */
  async computeFare(
    category: VehicleCategory,
    distanceM: number,
    waitingMinutes: number,
    when: Date = new Date(),
  ): Promise<FareBreakdown> {
    const tariff = await this.settings.getTariff(category);
    if (!tariff) {
      // Tarif topilmasa — faqat bazaviy 4000 (2.5 default).
      return {
        base: 4000,
        distance: 0,
        waiting: 0,
        subtotal: 4000,
        nightMultiplier: 1,
        surgeMultiplier: 1,
        total: 4000,
      };
    }

    const base = tariff.baseFare;
    const distance = (tariff.perKm * distanceM) / 1000;
    const billableWait = Math.max(0, waitingMinutes - tariff.freeWaitMin);
    const waiting = billableWait * tariff.waitingPerMin;
    const subtotal = base + distance + waiting;

    const nightMultiplier = this.isNight(tariff, when) ? tariff.nightMultiplier : 1;
    const surgeMultiplier = await this.settings.currentSurge();
    const total = Math.round(subtotal * nightMultiplier * surgeMultiplier);

    return { base, distance, waiting, subtotal, nightMultiplier, surgeMultiplier, total };
  }
}
