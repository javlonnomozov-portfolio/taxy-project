import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { InternalGuard } from '../auth/internal.guard';
import { UpsertCustomerDto } from './dto/customer.dto';

@ApiTags('customers')
@ApiSecurity('internal')
@Controller('customers')
@UseGuards(InternalGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post('upsert')
  @ApiOperation({ summary: 'Telegram foydalanuvchisini yaratish/yangilash (bot)' })
  upsert(@Body() dto: UpsertCustomerDto) {
    return this.customers.upsertByTelegram(dto);
  }
}
