import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { BaseTenantRepository, PrismaModelDelegate } from '../common/repositories/base-tenant.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository extends BaseTenantRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma.user as unknown as PrismaModelDelegate<User>);
  }

  findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.findFirst(tenantId, { email });
  }

  /** Sets the manager edge for a user, scoped to the tenant. */
  setManager(tenantId: string, userId: string, managerId: string | null): Promise<User | null> {
    return this.updateById(tenantId, userId, { managerId });
  }
}
