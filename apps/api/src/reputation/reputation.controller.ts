import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { ReputationService } from './reputation.service';
import { InternalGuard } from '../auth/internal.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';

class RateDto {
  @IsString() orderId!: string;
  @IsObject() scores!: Record<string, number>;
  @IsOptional() @IsString() comment?: string;
}

@Controller('ratings')
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  // Mijoz → haydovchi (bot orqali, ichki kalit).
  @UseGuards(InternalGuard)
  @Post('customer-to-driver')
  rateDriver(@Body() dto: RateDto) {
    return this.reputation.submit(dto.orderId, 'customer_to_driver', dto.scores, dto.comment);
  }

  // Haydovchi → mijoz (haydovchi JWT).
  @UseGuards(JwtAuthGuard)
  @Roles('driver')
  @Post('driver-to-customer')
  rateCustomer(@Req() _req: Request, @Body() dto: RateDto) {
    return this.reputation.submit(dto.orderId, 'driver_to_customer', dto.scores, dto.comment);
  }
}
