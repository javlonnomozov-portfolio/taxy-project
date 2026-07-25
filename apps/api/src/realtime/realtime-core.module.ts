import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

// Global singleton — gateway'lar Server'ni ro'yxatdan o'tkazadi, servislar emit qiladi.
@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeCoreModule {}
