import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContext } from '../interfaces/auth-context.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getRequest } from '../utils/request-context.util';

/**
 * Enforces @Roles() at the resolver level. Passes when no roles are required.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const user = (getRequest(context) as any).user as AuthContext | undefined;
    if (!user) {
      throw new ForbiddenException('No authenticated principal');
    }

    const ok = required.some((role) => user.roles.includes(role));
    if (!ok) {
      throw new ForbiddenException(`Requires one of roles: ${required.join(', ')}`);
    }
    return true;
  }
}
