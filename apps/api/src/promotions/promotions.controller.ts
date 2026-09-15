import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PanelRole } from '@tty/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, GroupMemberDto, GroupNameDto, UpdatePromotionDto } from './promotions.dto';

/** Guruhlar va aksiyalar — pul bilan bog'liq, shuning uchun faqat ADMIN+. */
@ApiTags('ops-promotions')
@ApiBearerAuth('jwt')
@Controller('ops')
@UseGuards(JwtAuthGuard)
@Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
export class PromotionsController {
  constructor(private readonly promo: PromotionsService) {}

  // ---- guruhlar ----

  @Get('driver-groups')
  listGroups() {
    return this.promo.listGroups();
  }

  @Post('driver-groups')
  createGroup(@Body() dto: GroupNameDto) {
    return this.promo.createGroup(dto.name);
  }

  @Put('driver-groups/:id')
  renameGroup(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: GroupNameDto) {
    return this.promo.renameGroup(id, dto.name);
  }

  @Delete('driver-groups/:id')
  deleteGroup(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.promo.deleteGroup(id);
  }

  @Get('driver-groups/:id/members')
  members(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.promo.groupMembers(id);
  }

  @Post('driver-groups/:id/members')
  addMember(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: GroupMemberDto) {
    return this.promo.addMember(id, dto.driverId);
  }

  @Delete('driver-groups/:id/members/:driverId')
  removeMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('driverId', new ParseUUIDPipe()) driverId: string,
  ) {
    return this.promo.removeMember(id, driverId);
  }

  @Get('drivers/:id/groups')
  driverGroups(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.promo.driverGroups(id);
  }

  // ---- aksiyalar ----

  @Get('promotions')
  listPromotions() {
    return this.promo.listPromotions();
  }

  @Post('promotions')
  createPromotion(@Body() dto: CreatePromotionDto) {
    return this.promo.createPromotion(dto);
  }

  @Put('promotions/:id')
  updatePromotion(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdatePromotionDto) {
    return this.promo.updatePromotion(id, dto);
  }

  @Delete('promotions/:id')
  deletePromotion(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.promo.deletePromotion(id);
  }
}
