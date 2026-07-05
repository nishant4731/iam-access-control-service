import { Injectable } from '@nestjs/common';
import { Policy } from '@prisma/client';
import { CacheService } from '../common/cache/cache.service';
import { CACHE_NAMES, CACHE_TTL_MS, cacheKeys } from '../common/cache/cache.keys';
import { BaseTenantRepository, PrismaModelDelegate } from '../common/repositories/base-tenant.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoliciesRepository extends BaseTenantRepository<Policy> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super(prisma.policy as unknown as PrismaModelDelegate<Policy>);
  }

  /**
   * Loads enabled policies applicable to an action + resource type, ordered by
   * priority. Wildcard ("*") action/resourceType policies are always included.
   */
  findApplicable(tenantId: string, action: string, resourceType: string): Promise<Policy[]> {
    // Cached per (tenant, action, resourceType). Invalidated by
    // PoliciesService.create for the whole tenant.
    return this.cache.wrap(
      cacheKeys.policies(tenantId, action, resourceType),
      CACHE_TTL_MS.policies,
      () =>
        this.prisma.policy.findMany({
          where: {
            tenantId,
            enabled: true,
            action: { in: [action, '*'] },
            resourceType: { in: [resourceType, '*'] },
          },
          orderBy: { priority: 'asc' },
        }),
      CACHE_NAMES.policies,
    );
  }
}
