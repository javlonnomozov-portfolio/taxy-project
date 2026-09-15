import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverGroup, DriverGroupMember } from '../entities/driver-group.entity';
import { Promotion } from '../entities/promotion.entity';
import { Driver } from '../entities/driver.entity';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';

/**
 * Haydovchi guruhlari va aksiyalar. `BillingModule` servisni import qiladi —
 * aksiya safar yakunlanganda to'lov hisobiga qo'llanadi.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DriverGroup, DriverGroupMember, Promotion, Driver])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
