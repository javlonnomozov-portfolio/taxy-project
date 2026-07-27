import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ReputationService } from './reputation.service';
import { InternalGuard } from '../auth/internal.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles';
import { RateDto } from './dto/rate.dto';

@ApiTags('ratings')
@Controller('ratings')
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  // Mijoz → haydovchi (bot orqali, ichki kalit).
  @UseGuards(InternalGuard)
  @ApiSecurity('internal')
  @Post('customer-to-driver')
  @ApiOperation({ summary: 'Mijoz haydovchini baholaydi' })
  rateDriver(@Body() dto: RateDto) {
    return this.reputation.submit(dto.orderId, 'customer_to_driver', dto.scores, dto.comment);
  }

  // Haydovchi → mijoz (haydovchi JWT).
  @UseGuards(JwtAuthGuard)
  @Roles('driver')
  @ApiBearerAuth('jwt')
  @Post('driver-to-customer')
  @ApiOperation({ summary: 'Haydovchi mijozni baholaydi' })
  rateCustomer(@Req() _req: Request, @Body() dto: RateDto) {
    return this.reputation.submit(dto.orderId, 'driver_to_customer', dto.scores, dto.comment);
  }
}
