import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Coarse-grained permission gate at the resolver level. The PermissionsGuard
 * requires the principal to hold at least one of the listed permissions.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
