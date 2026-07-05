import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { PaginationArgs, toPrismaPagination } from '../common/dto/pagination.args';
import { CreatePolicyInput } from './dto/create-policy.input';
import { Policy } from './entities/policy.entity';
import { PolicyMapper } from './policy.mapper';
import { PoliciesRepository } from './policies.repository';

@Injectable()
export class PoliciesService {
  constructor(
    private readonly repository: PoliciesRepository,
    private readonly cache: CacheService,
  ) {}

  async create(tenantId: string, input: CreatePolicyInput): Promise<Policy> {
    const model = await this.repository.create(tenantId, {
      name: input.name,
      description: input.description ?? null,
      effect: input.effect,
      action: input.action,
      resourceType: input.resourceType ?? '*',
      priority: input.priority ?? 100,
      enabled: input.enabled ?? true,
      // Strip undefined keys so the stored JSON is clean.
      conditions: JSON.parse(JSON.stringify(input.conditions)) as Prisma.InputJsonValue,
    });
    // New/changed policy affects future decisions — drop the tenant's policy cache.
    this.cache.delByPrefix(cacheKeys.policiesTenantPrefix(tenantId));
    return PolicyMapper.toEntity(model);
  }

  async findAll(tenantId: string, pagination?: PaginationArgs): Promise<Policy[]> {
    const { take, skip } = toPrismaPagination(pagination);
    return PolicyMapper.toEntities(
      await this.repository.findMany(tenantId, {}, { take, skip, orderBy: { priority: 'asc' } }),
    );
  }
}
