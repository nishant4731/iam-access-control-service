import { Permission as PermissionModel } from '@prisma/client';
import { Permission } from './entities/permission.entity';

export class PermissionMapper {
  static toEntity(model: PermissionModel): Permission {
    return {
      id: model.id,
      tenantId: model.tenantId,
      name: model.name,
      resource: model.resource,
      action: model.action,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntities(models: PermissionModel[]): Permission[] {
    return models.map((m) => PermissionMapper.toEntity(m));
  }
}
