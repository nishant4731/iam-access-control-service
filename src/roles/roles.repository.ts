import { Injectable } from '@nestjs/common';
import { Role, UserRole } from '@prisma/client';
import { BaseTenantRepository, PrismaModelDelegate } from '../common/repositories/base-tenant.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesRepository extends BaseTenantRepository<Role> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.role as unknown as PrismaModelDelegate<Role>);
  }

  findByName(tenantId: string, name: string): Promise<Role | null> {
    return this.findFirst(tenantId, { name });
  }

  /** Idempotently assign a role to a user (tenant-scoped join row). */
  async assignRoleToUser(tenantId: string, userId: string, roleId: string): Promise<UserRole> {
    return this.prisma.userRole.upsert({
      where: { tenantId_userId_roleId: { tenantId, userId, roleId } },
      create: { tenantId, userId, roleId },
      update: {},
    });
  }
}
