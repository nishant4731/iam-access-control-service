import { Injectable } from '@nestjs/common';
import { Prisma, ServiceIdentity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceIdentitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ServiceIdentityCreateInput): Promise<ServiceIdentity> {
    return this.prisma.serviceIdentity.create({ data });
  }

  /**
   * Global lookup by id — used during API-key validation, where the tenant is
   * *derived from* the identity (the caller has not yet been placed in a tenant
   * context). This is the one intentionally non-tenant-scoped read.
   */
  findByIdGlobal(id: string): Promise<ServiceIdentity | null> {
    return this.prisma.serviceIdentity.findUnique({ where: { id } });
  }

  findMany(tenantId: string, take: number, skip: number): Promise<ServiceIdentity[]> {
    return this.prisma.serviceIdentity.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      take,
      skip,
    });
  }
}
