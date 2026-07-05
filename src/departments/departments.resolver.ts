import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationArgs } from '../common/dto/pagination.args';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { CreateDepartmentInput } from './dto/create-department.input';
import { DepartmentsService } from './departments.service';
import { Department } from './entities/department.entity';

@Resolver(() => Department)
export class DepartmentsResolver {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Query(() => [Department], { description: 'Departments in the caller tenant (paginated).' })
  departments(
    @CurrentUser() user: AuthContext,
    @Args() pagination: PaginationArgs,
  ): Promise<Department[]> {
    return this.departmentsService.findAll(user.tenantId, pagination);
  }

  @Query(() => Department, { description: 'A department by id, scoped to the caller tenant.' })
  department(
    @CurrentUser() user: AuthContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Department> {
    return this.departmentsService.findById(user.tenantId, id);
  }

  @Mutation(() => Department)
  createDepartment(
    @CurrentUser() user: AuthContext,
    @Args('input') input: CreateDepartmentInput,
  ): Promise<Department> {
    // tenantId is taken from the verified token, never from the client payload.
    return this.departmentsService.create(user.tenantId, input);
  }
}
