import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { MiniappController } from './miniapp.controller';
import { MiniappService } from './miniapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../entities/customer.entity';

@Module({
  // Mantiq `CustomerOrdersService` da — Mini App faqat `initData` ni tekshirib
  // o'sha servisga uzatadi (qarang: miniapp.service.ts izohi).
  imports: [TypeOrmModule.forFeature([Customer]), CustomersModule],
  controllers: [MiniappController],
  providers: [MiniappService],
})
export class MiniappModule {}
