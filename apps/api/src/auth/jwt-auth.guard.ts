import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY, JwtPayload, ROLES_KEY, AuthRole } from './roles';
import { AccountStatusService } from './account-status.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly accounts: AccountStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token yo‘q');
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(auth.slice(7));
    } catch {
      throw new UnauthorizedException('Token yaroqsiz');
    }
    (req as Request & { user: JwtPayload }).user = payload;

    // Token haqiqiy, lekin hisob token berilgandan keyin bloklangan bo'lishi mumkin
    // (JWT 7 kun yashaydi). Shuning uchun hisob holatini ham tekshiramiz.
    if (!(await this.accounts.isActive(payload.role, payload.sub))) {
      throw new UnauthorizedException('Hisob bloklangan yoki mavjud emas');
    }

    const roles = this.reflector.getAllAndOverride<AuthRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Kim ekani aniq, lekin huquqi yetmaydi → 403 (401 emas: 401 "kim ekaningni
    // isbotla" degani va klientni qayta login qilishga undaydi).
    if (roles && roles.length > 0 && !roles.includes(payload.role)) {
      throw new ForbiddenException('Ruxsat yetarli emas');
    }
    return true;
  }
}
