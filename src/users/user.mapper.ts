import { User as UserModel } from '@prisma/client';
import { User } from './entities/user.entity';

/**
 * Maps the persistence model to the GraphQL type, deliberately dropping
 * `passwordHash` so credential material can never be returned by the API.
 */
export class UserMapper {
  static toEntity(model: UserModel): User {
    return {
      id: model.id,
      tenantId: model.tenantId,
      departmentId: model.departmentId,
      managerId: model.managerId,
      email: model.email,
      designation: model.designation,
      clearanceLevel: model.clearanceLevel,
      location: model.location,
      employmentStatus: model.employmentStatus,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntities(models: UserModel[]): User[] {
    return models.map((m) => UserMapper.toEntity(m));
  }
}
