import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTenantInput } from './dto/create-tenant.input';
import { Tenant } from './entities/tenant.entity';
import { TenantMapper } from './tenant.mapper';
import { TenantsRepository } from './tenants.repository';

@Injectable()
export class TenantsService {
  constructor(private readonly repository: TenantsRepository) {}

  async create(input: CreateTenantInput): Promise<Tenant> {
    const model = await this.repository.create({ name: input.name, slug: input.slug });
    return TenantMapper.toEntity(model);
  }

  async findById(id: string): Promise<Tenant> {
    const model = await this.repository.findById(id);
    if (!model) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return TenantMapper.toEntity(model);
  }

  async findAll(): Promise<Tenant[]> {
    return TenantMapper.toEntities(await this.repository.findAll());
  }
}
