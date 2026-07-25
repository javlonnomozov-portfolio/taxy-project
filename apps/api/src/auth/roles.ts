import { SetMetadata } from '@nestjs/common';
import { PanelRole } from '@tty/shared';

// Token'dagi rol: haydovchi yoki panel roli.
export type AuthRole = 'driver' | PanelRole;

export interface JwtPayload {
  sub: string; // foydalanuvchi id
  role: AuthRole;
  phone?: string;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
