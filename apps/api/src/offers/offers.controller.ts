import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, JwtPayload } from '../auth/roles';
import { DispatchService } from '../dispatch/dispatch.service';

// Haydovchi ilovasi: hozir kutilayotgan takliflar ro'yxati (fon/bildirishnoma uchun).
@ApiTags('offers')
@ApiBearerAuth('jwt')
@Controller('offers')
@UseGuards(JwtAuthGuard)
@Roles('driver')
export class OffersController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Kutilayotgan takliflar (qolgan vaqti bilan)' })
  pending(@Req() req: Request) {
    const user = (req as Request & { user: JwtPayload }).user;
    return this.dispatch.pendingOffersFor(user.sub);
  }
}
