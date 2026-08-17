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

  findById(id: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { id } });
  }
}
