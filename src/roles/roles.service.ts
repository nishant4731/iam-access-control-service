import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { cacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { PaginationArgs, toPrismaPagination } from '../common/dto/pagination.args';
import { UsersRepository } from '../users/users.repository';
import { AssignRoleInput } from './dto/assign-role.input';
import { CreateRoleInput } from './dto/create-role.input';
import { Role } from './entities/role.entity';
import { RoleMapper } from './role.mapper';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly cache: CacheService,
  ) {}

  async create(tenantId: string, input: CreateRoleInput): Promise<Role> {
    const model = await this.repository.create(tenantId, {
      name: input.name,
      description: input.description ?? null,
    });
    return RoleMapper.toEntity(model);
  }

  async assignRole(tenantId: string, input: AssignRoleInput): Promise<Role> {
    const [role, user] = await Promise.all([
      this.repository.findById(tenantId, input.roleId),
      this.usersRepository.findById(tenantId, input.userId),
    ]);
    if (!role) {
      throw new NotFoundException(`Role ${input.roleId} not found`);
    }
    if (!user) {
      throw new BadRequestException('User not found within this tenant');
    }
    await this.repository.assignRoleToUser(tenantId, input.userId, input.roleId);
    // The user's effective permissions changed — drop their cached set.
    this.cache.del(cacheKeys.permissions(tenantId, input.userId));
    return RoleMapper.toEntity(role);
  }

  async findById(tenantId: string, id: string): Promise<Role> {
    const model = await this.repository.findById(tenantId, id);
    if (!model) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return RoleMapper.toEntity(model);
  }

  async findAll(tenantId: string, pagination?: PaginationArgs): Promise<Role[]> {
    const { take, skip } = toPrismaPagination(pagination);
    return RoleMapper.toEntities(
      await this.repository.findMany(tenantId, {}, { take, skip, orderBy: { name: 'asc' } }),
    );
  }
}
