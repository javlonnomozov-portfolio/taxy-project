import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { CustomersService } from './customers.service';
import { InternalGuard } from '../auth/internal.guard';

class UpsertCustomerDto {
  @IsString() telegramId!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() language?: string;
}

@Controller('customers')
@UseGuards(InternalGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post('upsert')
  upsert(@Body() dto: UpsertCustomerDto) {
    return this.customers.upsertByTelegram(dto);
  }
}
