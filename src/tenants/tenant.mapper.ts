import { Tenant as TenantModel } from '@prisma/client';
import { Tenant } from './entities/tenant.entity';

/**
 * Maps the Prisma persistence model to the GraphQL object type so the database
 * schema never leaks directly into the API surface.
 */
export class TenantMapper {
  static toEntity(model: TenantModel): Tenant {
    return {
      id: model.id,
      name: model.name,
      slug: model.slug,
      status: model.status,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntities(models: TenantModel[]): Tenant[] {
    return models.map((m) => TenantMapper.toEntity(m));
  }
}
