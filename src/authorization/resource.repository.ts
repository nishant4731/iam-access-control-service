import { Injectable } from '@nestjs/common';
import { ClearanceLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceFacts } from './contracts/authorization.contracts';

/**
 * Resolves a resource reference into the facts the engine needs (owner,
 * department, sensitivity). Tenant-scoped, so a resource from another tenant is
 * simply not found — the basis of cross-tenant DENY.
 *
 * Resolution strategy:
 *  1. Look up an explicit Resource row by (tenant, type, externalId).
 *  2. For "employee" resources, fall back to treating the id as a user id,
 *     deriving owner/department from the user record.
 */
@Injectable()
export class ResourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    tenantId: string,
    type: string,
    externalId: string,
    extraAttributes: Record<string, unknown> = {},
  ): Promise<ResourceFacts | null> {
    const resource = await this.prisma.resource.findFirst({
      where: { tenantId, type, externalId },
    });
    if (resource) {
      return {
        resourceType: type,
        resourceId: externalId,
        ownerUserId: resource.ownerUserId,
        departmentId: resource.departmentId,
        sensitivity: resource.sensitivity,
        attributes: { ...((resource.attributes as object) ?? {}), ...extraAttributes },
      };
    }

    if (type === 'employee') {
      const user = await this.prisma.user.findFirst({ where: { tenantId, id: externalId } });
      if (user) {
        return {
          resourceType: type,
          resourceId: externalId,
          ownerUserId: user.id,
          departmentId: user.departmentId,
          sensitivity: ClearanceLevel.CONFIDENTIAL,
          attributes: extraAttributes,
        };
      }
    }

    return null;
  }
}
