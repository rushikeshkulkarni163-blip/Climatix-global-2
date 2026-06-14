import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { JwtPayload } from '../auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (!user) throw new ForbiddenException('No authenticated user.');

    // Super-admin bypasses all checks
    if (user.roles.includes('super_admin')) return true;

    if (requiredRoles?.length) {
      const hasRole = requiredRoles.some((r) => user.roles.includes(r));
      if (!hasRole) throw new ForbiddenException(`Insufficient role. Required: ${requiredRoles.join(' or ')}`);
    }

    if (requiredPermissions?.length) {
      const hasPermission = requiredPermissions.every((p) => user.permissions.includes(p));
      if (!hasPermission) throw new ForbiddenException(`Missing permission: ${requiredPermissions.filter((p) => !user.permissions.includes(p)).join(', ')}`);
    }

    return true;
  }
}
