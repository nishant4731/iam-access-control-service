/**
 * Centralized cache key builders and TTLs — used by both the read side
 * (repositories) and the invalidation side (services) so they can never drift.
 */
export const CACHE_TTL_MS = {
  permissions: 30_000,
  policies: 30_000,
} as const;

export const cacheKeys = {
  permissions: (tenantId: string, userId: string) => `perms:${tenantId}:${userId}`,
  permissionsTenantPrefix: (tenantId: string) => `perms:${tenantId}:`,
  policies: (tenantId: string, action: string, resourceType: string) =>
    `pol:${tenantId}:${action}:${resourceType}`,
  policiesTenantPrefix: (tenantId: string) => `pol:${tenantId}:`,
} as const;

export const CACHE_NAMES = {
  permissions: 'permissions',
  policies: 'policies',
} as const;
