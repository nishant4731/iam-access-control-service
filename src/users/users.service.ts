import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PaginationArgs, toPrismaPagination } from '../common/dto/pagination.args';
import { HierarchyService } from '../hierarchy/hierarchy.service';
import { AssignManagerInput } from './dto/assign-manager.input';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { User } from './entities/user.entity';
import { UserMapper } from './user.mapper';
import { UsersRepository } from './users.repository';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly hierarchyService: HierarchyService,
  ) {}

  async create(tenantId: string, input: CreateUserInput): Promise<User> {
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
      : null;

    const model = await this.repository.create(tenantId, {
      email: input.email,
      passwordHash,
      departmentId: input.departmentId ?? null,
      designation: input.designation ?? null,
      clearanceLevel: input.clearanceLevel ?? undefined,
      location: input.location ?? null,
      employmentStatus: input.employmentStatus ?? undefined,
    });

    // Register the user as a hierarchy node; attach to manager if provided.
    await this.hierarchyService.addNode(tenantId, model.id);
    if (input.managerId) {
      await this.hierarchyService.assignManager(tenantId, model.id, input.managerId);
    }

    // Re-read so the persisted managerId is reflected.
    const fresh = await this.repository.findById(tenantId, model.id);
    return UserMapper.toEntity(fresh ?? model);
  }

  async assignManager(tenantId: string, input: AssignManagerInput): Promise<User> {
    const [user, manager] = await Promise.all([
      this.repository.findById(tenantId, input.userId),
      this.repository.findById(tenantId, input.managerId),
    ]);
    if (!user) {
      throw new NotFoundException(`User ${input.userId} not found`);
    }
    if (!manager) {
      // Also blocks cross-tenant managers: manager must exist within the tenant.
      throw new BadRequestException('Manager not found within this tenant');
    }

    await this.hierarchyService.assignManager(tenantId, input.userId, input.managerId);
    const fresh = await this.repository.findById(tenantId, input.userId);
    return UserMapper.toEntity(fresh!);
  }

  async update(tenantId: string, input: UpdateUserInput): Promise<User> {
    const { id, ...changes } = input;
    if (changes.departmentId) {
      // (department existence is enforced by the FK within the tenant)
    }
    const updated = await this.repository.updateById(tenantId, id, changes);
    if (!updated) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return UserMapper.toEntity(updated);
  }

  async findById(tenantId: string, id: string): Promise<User> {
    const model = await this.repository.findById(tenantId, id);
    if (!model) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return UserMapper.toEntity(model);
  }

  async findAll(tenantId: string, pagination?: PaginationArgs): Promise<User[]> {
    const { take, skip } = toPrismaPagination(pagination);
    return UserMapper.toEntities(
      await this.repository.findMany(tenantId, {}, { take, skip, orderBy: { email: 'asc' } }),
    );
  }
}
