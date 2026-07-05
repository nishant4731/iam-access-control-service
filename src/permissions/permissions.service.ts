import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { cacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { PaginationArgs, toPrismaPagination } from '../common/dto/pagination.args';
import { AssignPermissionInput } from './dto/assign-permission.input';
import { CreatePermissionInput } from './dto/create-permission.input';
import { Permission } from './entities/permission.entity';
import { PermissionMapper } from './permission.mapper';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly repository: PermissionsRepository,
    private readonly cache: CacheService,
  ) {}

  async create(tenantId: string, input: CreatePermissionInput): Promise<Permission> {
    const model = await this.repository.create(tenantId, {
      name: input.name,
      resource: input.resource,
      action: input.action,
    });
    return PermissionMapper.toEntity(model);
  }

  async assignPermission(tenantId: string, input: AssignPermissionInput): Promise<Permission> {
    const permission = await this.repository.findById(tenantId, input.permissionId);
    if (!permission) {
      throw new NotFoundException(`Permission ${input.permissionId} not found`);
    }
    // Role existence within tenant is enforced by the FK + tenant scoping.
    try {
      await this.repository.assignPermissionToRole(tenantId, input.roleId, input.permissionId);
    } catch {
      throw new BadRequestException('Role not found within this tenant');
    }
    // Any user holding this role now has different permissions — drop the
    // tenant's permission caches.
    this.cache.delByPrefix(cacheKeys.permissionsTenantPrefix(tenantId));
    return PermissionMapper.toEntity(permission);
  }

  async findAll(tenantId: string, pagination?: PaginationArgs): Promise<Permission[]> {
    const { take, skip } = toPrismaPagination(pagination);
    return PermissionMapper.toEntities(
      await this.repository.findMany(tenantId, {}, { take, skip, orderBy: { name: 'asc' } }),
    );
  }
}
