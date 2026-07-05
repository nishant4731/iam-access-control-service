import { Department as DepartmentModel } from '@prisma/client';
import { Department } from './entities/department.entity';

export class DepartmentMapper {
  static toEntity(model: DepartmentModel): Department {
    return {
      id: model.id,
      tenantId: model.tenantId,
      name: model.name,
      parentDepartmentId: model.parentDepartmentId,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntities(models: DepartmentModel[]): Department[] {
    return models.map((m) => DepartmentMapper.toEntity(m));
  }
}
