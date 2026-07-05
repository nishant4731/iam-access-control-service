import { Injectable } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tenant is the one entity that is NOT tenant-scoped (it defines the tenant),
 * so this repository does not extend BaseTenantRepository. Access is guarded at
 * the resolver level (platform Admin only).
 */
@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { name: string; slug: string }): Promise<Tenant> {
    return this.prisma.tenant.create({ data });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  findAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  }
}
