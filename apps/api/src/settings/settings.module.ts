import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { Settings } from '../entities/settings.entity';
import { Tariff } from '../entities/tariff.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Settings, Tariff])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
