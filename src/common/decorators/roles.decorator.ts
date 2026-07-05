import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'requiredRoles';

/**
 * Coarse-grained RBAC gate at the resolver level. The RolesGuard requires the
 * principal to hold at least one of the listed roles. Fine-grained,
 * resource-aware decisions are made by the AuthorizationService.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
