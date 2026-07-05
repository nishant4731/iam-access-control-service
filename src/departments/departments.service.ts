import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationArgs, toPrismaPagination } from '../common/dto/pagination.args';
import { CreateDepartmentInput } from './dto/create-department.input';
import { DepartmentMapper } from './department.mapper';
import { DepartmentsRepository } from './departments.repository';
import { Department } from './entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(private readonly repository: DepartmentsRepository) {}

  async create(tenantId: string, input: CreateDepartmentInput): Promise<Department> {
    if (input.parentDepartmentId) {
      const parent = await this.repository.findById(tenantId, input.parentDepartmentId);
      if (!parent) {
        throw new BadRequestException('parentDepartmentId does not exist in this tenant');
      }
    }
    const model = await this.repository.create(tenantId, {
      name: input.name,
      parentDepartmentId: input.parentDepartmentId ?? null,
    });
    return DepartmentMapper.toEntity(model);
  }

  async findById(tenantId: string, id: string): Promise<Department> {
    const model = await this.repository.findById(tenantId, id);
    if (!model) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return DepartmentMapper.toEntity(model);
  }

  async findAll(tenantId: string, pagination?: PaginationArgs): Promise<Department[]> {
    const { take, skip } = toPrismaPagination(pagination);
    return DepartmentMapper.toEntities(
      await this.repository.findMany(tenantId, {}, { take, skip, orderBy: { name: 'asc' } }),
    );
  }
}
