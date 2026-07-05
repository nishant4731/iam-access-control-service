import { Injectable } from '@nestjs/common';
import { Permission, RolePermission } from '@prisma/client';
import { CacheService } from '../common/cache/cache.service';
import { CACHE_NAMES, CACHE_TTL_MS, cacheKeys } from '../common/cache/cache.keys';
import { BaseTenantRepository, PrismaModelDelegate } from '../common/repositories/base-tenant.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsRepository extends BaseTenantRepository<Permission> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super(prisma.permission as unknown as PrismaModelDelegate<Permission>);
  }

  findByName(tenantId: string, name: string): Promise<Permission | null> {
    return this.findFirst(tenantId, { name });
  }

  /** Idempotently grant a permission to a role (tenant-scoped join row). */
  async assignPermissionToRole(
    tenantId: string,
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission> {
    return this.prisma.rolePermission.upsert({
      where: { tenantId_roleId_permissionId: { tenantId, roleId, permissionId } },
      create: { tenantId, roleId, permissionId },
      update: {},
    });
  }

  /**
   * Returns the set of permission names effectively held by a user via their
   * roles. Used by the RBAC evaluator.
   */
  async permissionNamesForUser(tenantId: string, userId: string): Promise<string[]> {
    // Cached: this is on the hot authorization path. Invalidated by
    // RolesService.assignRole / PermissionsService.assignPermission.
    return this.cache.wrap(
      cacheKeys.permissions(tenantId, userId),
      CACHE_TTL_MS.permissions,
      async () => {
        const rows = await this.prisma.userRole.findMany({
          where: { tenantId, userId },
          select: {
            role: { select: { rolePermissions: { select: { permission: { select: { name: true, resource: true, action: true } } } } } },
          },
        });
        const names = new Set<string>();
        for (const ur of rows) {
          for (const rp of ur.role.rolePermissions) {
            names.add(rp.permission.name);
          }
        }
        return [...names];
      },
      CACHE_NAMES.permissions,
    );
  }
}
