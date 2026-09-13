import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  /**
   * Operator qo'shgan summa (`orders.fare_adjustment`). Koeffitsientlardan
   * KEYIN qo'shiladi: kelishilgan "yuk uchun 5 000" tungi tarifda 6 000 ga
   * aylanib qolmasin — mijozga aytilgan raqam aynan shu bo'lib qolsin.
   */
  adjustment: number;
  total: number;
}

@Injectable()
export class PricingService {
  private readonly maxBillableWaitMin: number;

  constructor(
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.maxBillableWaitMin = config.get<number>('MAX_BILLABLE_WAIT_MIN') ?? 30;
  }

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
    adjustment = 0,
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
        adjustment,
        total: Math.max(0, 4000 + adjustment),
      };
    }

    const base = tariff.baseFare;
    const distance = (tariff.perKm * distanceM) / 1000;
    // Chegara AYNAN shu yerda — `orders.waiting_minutes` da haqiqiy qiymat
    // saqlanib qolsin (tekshiruv/hisobot uchun), lekin mijozdan olinadigan pul
    // cheklangan bo'lsin: haydovchi "yetib keldim" bosib ketib qolsa hisob
    // cheksiz o'smasin.
    const capped = Math.min(waitingMinutes, this.maxBillableWaitMin);
    const billableWait = Math.max(0, capped - tariff.freeWaitMin);
    const waiting = billableWait * tariff.waitingPerMin;
    const subtotal = base + distance + waiting;

    const nightMultiplier = this.isNight(tariff, when) ? tariff.nightMultiplier : 1;
    // Koeffitsient TOIFANIKI, bosh kalit esa umumiy — shunda operator bitta
    // tugma bilan qimmatlashuvni butunlay o'chira oladi.
    const surgeMultiplier = (await this.settings.surgeActive())
      ? Number(tariff.surgeMultiplier) || 1
      : 1;
    // Qo'shimcha KOEFFITSIENTLARDAN KEYIN qo'shiladi — kelishilgan "yuk uchun
    // 5 000" tungi tarifda 6 000 ga aylanib qolmasin. Manfiy chegirma butun
    // hisobni minusga tushirmasligi uchun 0 dan pastga tushmaydi.
    const metered = Math.round(subtotal * nightMultiplier * surgeMultiplier);
    const total = Math.max(0, metered + adjustment);

    return {
      base,
      distance,
      waiting,
      subtotal,
      nightMultiplier,
      surgeMultiplier,
      adjustment,
      total,
    };
  }
}
