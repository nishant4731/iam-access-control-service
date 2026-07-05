import { Injectable } from '@nestjs/common';
import { Department } from '@prisma/client';
import { BaseTenantRepository, PrismaModelDelegate } from '../common/repositories/base-tenant.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsRepository extends BaseTenantRepository<Department> {
  constructor(prisma: PrismaService) {
    super(prisma.department as unknown as PrismaModelDelegate<Department>);
  }

  findByName(tenantId: string, name: string): Promise<Department | null> {
    return this.findFirst(tenantId, { name });
  }
}
