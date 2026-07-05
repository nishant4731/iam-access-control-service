import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthContext } from '../interfaces/auth-context.interface';
import { getRequest } from '../utils/request-context.util';

/**
 * Defense-in-depth tenant isolation guard.
 *
 * If a client sends a `tenantId` in its GraphQL arguments (either at the top
 * level or nested under `input`), it MUST match the tenant of the
 * authenticated principal. This blocks cross-tenant access attempts at the
 * edge, in addition to the repository-level scoping that is the primary
 * enforcement mechanism.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = (getRequest(context) as any).user as AuthContext | undefined;
    if (!user) {
      // Auth guard runs first; if there is no principal this is not our concern.
      return true;
    }

    if (context.getType<'graphql'>() !== 'graphql') {
      return true;
    }

    const args = GqlExecutionContext.create(context).getArgs<Record<string, any>>();
    const claimedTenantId: string | undefined = args?.tenantId ?? args?.input?.tenantId;

    if (claimedTenantId && claimedTenantId !== user.tenantId) {
      throw new ForbiddenException('Cross-tenant access denied: tenant mismatch');
    }
    return true;
  }
}
