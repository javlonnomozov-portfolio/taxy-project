import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Driver } from '../entities/driver.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Driver])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
