import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationArgs } from '../common/dto/pagination.args';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { AssignRoleInput } from './dto/assign-role.input';
import { CreateRoleInput } from './dto/create-role.input';
import { Role } from './entities/role.entity';
import { RolesService } from './roles.service';

@Resolver(() => Role)
export class RolesResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query(() => [Role], { description: 'Roles in the caller tenant (paginated).' })
  roles(@CurrentUser() user: AuthContext, @Args() pagination: PaginationArgs): Promise<Role[]> {
    return this.rolesService.findAll(user.tenantId, pagination);
  }

  @Query(() => Role, { description: 'A role by id, scoped to the caller tenant.' })
  role(
    @CurrentUser() user: AuthContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Role> {
    return this.rolesService.findById(user.tenantId, id);
  }

  @Mutation(() => Role)
  createRole(
    @CurrentUser() user: AuthContext,
    @Args('input') input: CreateRoleInput,
  ): Promise<Role> {
    return this.rolesService.create(user.tenantId, input);
  }

  @Mutation(() => Role, { description: 'Assign a role to a user.' })
  assignRole(
    @CurrentUser() user: AuthContext,
    @Args('input') input: AssignRoleInput,
  ): Promise<Role> {
    return this.rolesService.assignRole(user.tenantId, input);
  }
}
