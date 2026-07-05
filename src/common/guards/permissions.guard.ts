import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContext } from '../interfaces/auth-context.interface';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { getRequest } from '../utils/request-context.util';

/**
 * Enforces @RequirePermission() at the resolver level. Passes when no
 * permission is required.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
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

    // Wildcards mirror the RBAC evaluator: "*" grants everything and
    // "<resource>.*" grants any action on that resource.
    const held = new Set(user.permissions);
    const ok =
      held.has('*') ||
      required.some((perm) => held.has(perm) || held.has(`${perm.split('.')[0]}.*`));
    if (!ok) {
      throw new ForbiddenException(`Requires one of permissions: ${required.join(', ')}`);
    }
    return true;
  }
}
