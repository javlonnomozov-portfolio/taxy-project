import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleCategory } from '@tty/shared';
import { Settings, SettingsConfig } from '../entities/settings.entity';
import { Tariff } from '../entities/tariff.entity';

const DEFAULTS: SettingsConfig = { surgeMultiplier: 1.0, surgeActive: false, freeCancelSec: 120 };

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings) private readonly settings: Repository<Settings>,
    @InjectRepository(Tariff) private readonly tariffs: Repository<Tariff>,
  ) {}

  async getConfig(): Promise<SettingsConfig> {
    const row = await this.settings.findOne({ where: { id: 1 } });
    return { ...DEFAULTS, ...(row?.config ?? {}) };
  }

  async updateConfig(patch: Partial<SettingsConfig>): Promise<SettingsConfig> {
    const current = await this.getConfig();
    const next = { ...current, ...patch };
    await this.settings.upsert({ id: 1, config: next }, ['id']);
    return next;
  }

  /** Amaldagi surge (faol bo'lsa multiplier, aks holda 1.0). */
  async currentSurge(): Promise<number> {
    const c = await this.getConfig();
    return c.surgeActive ? Number(c.surgeMultiplier) || 1.0 : 1.0;
  }

  getTariff(category: VehicleCategory): Promise<Tariff | null> {
    return this.tariffs.findOne({ where: { category } });
  }

  listTariffs(): Promise<Tariff[]> {
    return this.tariffs.find();
  }

  async updateTariff(category: VehicleCategory, patch: Partial<Tariff>): Promise<Tariff> {
    const t = await this.tariffs.findOne({ where: { category } });
    if (!t) throw new NotFoundException('Tarif topilmadi');
    Object.assign(t, patch);
    return this.tariffs.save(t);
  }
}
