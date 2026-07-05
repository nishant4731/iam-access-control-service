import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationArgs } from '../common/dto/pagination.args';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { AssignPermissionInput } from './dto/assign-permission.input';
import { CreatePermissionInput } from './dto/create-permission.input';
import { Permission } from './entities/permission.entity';
import { PermissionsService } from './permissions.service';

@Resolver(() => Permission)
export class PermissionsResolver {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Query(() => [Permission], { description: 'Permissions in the caller tenant (paginated).' })
  permissions(
    @CurrentUser() user: AuthContext,
    @Args() pagination: PaginationArgs,
  ): Promise<Permission[]> {
    return this.permissionsService.findAll(user.tenantId, pagination);
  }

  @Mutation(() => Permission)
  createPermission(
    @CurrentUser() user: AuthContext,
    @Args('input') input: CreatePermissionInput,
  ): Promise<Permission> {
    return this.permissionsService.create(user.tenantId, input);
  }

  @Mutation(() => Permission, { description: 'Grant a permission to a role.' })
  assignPermission(
    @CurrentUser() user: AuthContext,
    @Args('input') input: AssignPermissionInput,
  ): Promise<Permission> {
    return this.permissionsService.assignPermission(user.tenantId, input);
  }
}
