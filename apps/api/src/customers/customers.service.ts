import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { normalizeUzPhone } from '@tty/shared';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly repo: Repository<Customer>) {}

  /** Bot orqali: telegram_id bo'yicha yaratish yoki yangilash. */
  async upsertByTelegram(data: {
    telegramId: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    language?: string;
  }): Promise<Customer> {
    let customer = await this.repo.findOne({ where: { telegramId: data.telegramId } });
    if (!customer) {
      customer = this.repo.create({ telegramId: data.telegramId });
    }
    // Raqam SHU YERDA normallashtiriladi — bu barcha yozuvlar o'tadigan yagona
    // nuqta. Bot'da ikkita ro'yxatdan o'tish yo'li bor edi (qo'lda yozish va
    // kontakt ulashish) va ikkinchisidan normalizatsiya tushib qolgani uchun
    // mijozlar bazada `+` siz saqlanardi.
    if (data.phone !== undefined) customer.phone = normalizeUzPhone(data.phone);
    if (data.firstName !== undefined) customer.firstName = data.firstName;
    if (data.lastName !== undefined) customer.lastName = data.lastName;
    if (data.language !== undefined) customer.language = data.language;
    return this.repo.save(customer);
  }

  /**
   * Kabinetdan tahrirlash — ism/familiya/telefon/til.
   *
   * Telefon SHU YERDA ham normallashtiriladi (`upsertByTelegram` bilan bir xil
   * qoida) — aks holda bazada ikki xil formatdagi raqamlar paydo bo'lardi
   * (bot'da aynan shu xato bo'lgan edi).
   *
   * `language` ham shu yerda saqlanadi: bot mijozga xabarni SHU ustundagi
   * tilda yuboradi, ilovadagi til esa faqat qurilmada turardi — ikkalasi
   * bir-biridan ajralib ketmasin.
   */
  async updateProfile(
    id: string,
    patch: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      language?: string;
    },
  ): Promise<void> {
    const next: Partial<Customer> = {};
    if (patch.firstName !== undefined) next.firstName = patch.firstName.trim() || null;
    if (patch.lastName !== undefined) next.lastName = patch.lastName.trim() || null;
    if (patch.phone !== undefined) next.phone = patch.phone.trim() ? normalizeUzPhone(patch.phone) : null;
    if (patch.language !== undefined) next.language = patch.language;
    if (Object.keys(next).length === 0) return;
    await this.repo.update(id, next);
  }

  findById(id: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** "Uy"/"Ish" — joriy nuqtani shu nom ostida saqlaydi (ustiga yozadi). */
  async saveAddress(id: string, label: 'home' | 'work', lat: number, lng: number): Promise<void> {
    const patch =
      label === 'home' ? { homeLat: lat, homeLng: lng } : { workLat: lat, workLng: lng };
    await this.repo.update(id, patch);
  }

  async clearAddress(id: string, label: 'home' | 'work'): Promise<void> {
    const patch =
      label === 'home' ? { homeLat: null, homeLng: null } : { workLat: null, workLng: null };
    await this.repo.update(id, patch);
  }

  async getAddresses(
    id: string,
  ): Promise<{ home: { lat: number; lng: number } | null; work: { lat: number; lng: number } | null }> {
    const c = await this.findById(id);
    return {
      home: c?.homeLat != null && c?.homeLng != null ? { lat: c.homeLat, lng: c.homeLng } : null,
      work: c?.workLat != null && c?.workLng != null ? { lat: c.workLat, lng: c.workLng } : null,
    };
  }
}
