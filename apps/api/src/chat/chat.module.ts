import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverMessage } from '../entities/driver-message.entity';
import { ChatMedia } from '../entities/chat-media.entity';
import { Driver } from '../entities/driver.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Order } from '../entities/order.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { ChatService } from './chat.service';
import { ChatRetentionService } from './chat-retention.service';
import { DriverChatController, OpsChatController } from './chat.controller';

/**
 * Haydovchi <-> panel chati. `RealtimeService` va `REDIS` global modullardan
 * keladi (OpsModule ham ularni shunday oladi).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DriverMessage, ChatMedia, Driver, Vehicle, Order, AdminUser])],
  controllers: [DriverChatController, OpsChatController],
  providers: [ChatService, ChatRetentionService],
})
export class ChatModule {}
