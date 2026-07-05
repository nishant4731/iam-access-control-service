import { Role as RoleModel } from '@prisma/client';
import { Role } from './entities/role.entity';

export class RoleMapper {
  static toEntity(model: RoleModel): Role {
    return {
      id: model.id,
      tenantId: model.tenantId,
      name: model.name,
      description: model.description,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntities(models: RoleModel[]): Role[] {
    return models.map((m) => RoleMapper.toEntity(m));
  }
}
