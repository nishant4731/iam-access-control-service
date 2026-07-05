import { ServiceIdentity as ServiceIdentityModel } from '@prisma/client';
import { ServiceIdentity } from './entities/service-identity.entity';

/**
 * Maps the persistence model to the GraphQL type, deliberately dropping
 * `apiKeyHash` so credential material is never returned by the API.
 */
export class ServiceIdentityMapper {
  static toEntity(model: ServiceIdentityModel): ServiceIdentity {
    return {
      id: model.id,
      tenantId: model.tenantId,
      name: model.name,
      enabled: model.enabled,
      createdAt: model.createdAt,
    };
  }

  static toEntities(models: ServiceIdentityModel[]): ServiceIdentity[] {
    return models.map((m) => ServiceIdentityMapper.toEntity(m));
  }
}
