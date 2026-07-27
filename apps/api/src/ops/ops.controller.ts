import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PanelRole, VehicleCategory } from '@tty/shared';
import { OpsService } from './ops.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles';

class AssignDto {
  @IsString() driverId!: string;
}
class CloseDto {
  @IsOptional() @IsString() reason?: string;
}
class SettingsDto {
  @IsOptional() @IsNumber() surgeMultiplier?: number;
  @IsOptional() @IsBoolean() surgeActive?: boolean;
  @IsOptional() @IsNumber() freeCancelSec?: number;
}
class TopUpDto {
  @IsNumber() amount!: number;
  @IsOptional() @IsString() note?: string;
}
class BillingDto {
  @IsString() mode!: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
class NewVehicleDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() plate?: string;
  @IsEnum(VehicleCategory) category!: VehicleCategory;
}
class CreateDriverDto {
  @IsString() phone!: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @ValidateNested() @Type(() => NewVehicleDto) vehicle!: NewVehicleDto;
}
class CreateAdminDto {
  @IsString() login!: string;
  @IsString() @MinLength(6) password!: string;
  @IsEnum(PanelRole) role!: PanelRole;
}

@Controller('ops')
@UseGuards(JwtAuthGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  // --- Buyurtmalar (operator+) ---
  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('orders')
  orders(@Query('status') status?: OrderStatus) {
    return this.ops.listOrders(status);
  }

  // Zakazlar tarixi (joriy + tugagan).
  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('orders/history')
  ordersHistory(@Query('status') status?: OrderStatus) {
    return this.ops.ordersHistory(status);
  }

  // Foydalanuvchilar (mijozlar).
  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('customers')
  customers() {
    return this.ops.listCustomers();
  }

  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('orders/:id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.ops.assign(id, dto.driverId);
  }

  // Xaritadan tanlangan haydovchiga yo'naltirilgan taklif (haydovchi ilovada qabul qiladi).
  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('orders/:id/offer')
  offer(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.ops.offerToDriver(id, dto.driverId);
  }

  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('orders/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseDto) {
    return this.ops.close(id, dto.reason);
  }

  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('scheduled')
  scheduled() {
    return this.ops.listScheduled();
  }

  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('orders/:id/confirm-scheduled')
  confirmScheduled(@Param('id') id: string) {
    return this.ops.confirmScheduled(id);
  }

  // Jonli xarita uchun onlayn/safardagi taksilar (operator+).
  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('drivers/online')
  activeDrivers() {
    return this.ops.listActiveDrivers();
  }

  // --- Haydovchilar (admin+) ---
  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('drivers')
  drivers() {
    return this.ops.listDrivers();
  }

  // Super-admin haydovchini qo'lda qo'shadi → temp parol (bir marta) qaytadi.
  @Roles(PanelRole.SUPER_ADMIN)
  @Post('drivers')
  createDriver(@Body() dto: CreateDriverDto) {
    return this.ops.createDriver(dto);
  }

  // Super-admin operator/admin akkaunt yaratadi.
  @Roles(PanelRole.SUPER_ADMIN)
  @Post('admins')
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.ops.createAdmin(dto.login, dto.password, dto.role);
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('drivers/:id/approve')
  approve(@Param('id') id: string) {
    return this.ops.approveDriver(id);
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('drivers/:id/block')
  block(@Param('id') id: string) {
    return this.ops.blockDriver(id);
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Put('drivers/:id/billing')
  billing(@Param('id') id: string, @Body() dto: BillingDto) {
    return this.ops.setBilling(id, dto.mode, dto.config);
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Post('drivers/:id/topup')
  topup(@Param('id') id: string, @Body() dto: TopUpDto) {
    return this.ops.topUpDriver(id, dto.amount, dto.note);
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('drivers/:id/transactions')
  transactions(@Param('id') id: string) {
    return this.ops.driverTransactions(id);
  }

  // --- Sozlamalar (admin+) ---
  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('settings')
  getSettings() {
    return this.ops.getSettings();
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Put('settings')
  updateSettings(@Body() dto: SettingsDto) {
    return this.ops.updateSettings(dto);
  }

  @Roles(PanelRole.OPERATOR, PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Get('tariffs')
  tariffs() {
    return this.ops.listTariffs();
  }

  @Roles(PanelRole.ADMIN, PanelRole.SUPER_ADMIN)
  @Put('tariffs/:category')
  updateTariff(@Param('category') category: VehicleCategory, @Body() body: Record<string, number>) {
    return this.ops.updateTariff(category, body);
  }
}
