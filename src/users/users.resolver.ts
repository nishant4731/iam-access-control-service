import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationArgs } from '../common/dto/pagination.args';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { AssignManagerInput } from './dto/assign-manager.input';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User], { description: 'Users in the caller tenant (paginated).' })
  users(@CurrentUser() user: AuthContext, @Args() pagination: PaginationArgs): Promise<User[]> {
    return this.usersService.findAll(user.tenantId, pagination);
  }

  @Query(() => User, { description: 'A user by id, scoped to the caller tenant.' })
  user(
    @CurrentUser() principal: AuthContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<User> {
    return this.usersService.findById(principal.tenantId, id);
  }

  @Mutation(() => User)
  createUser(
    @CurrentUser() principal: AuthContext,
    @Args('input') input: CreateUserInput,
  ): Promise<User> {
    return this.usersService.create(principal.tenantId, input);
  }

  @Mutation(() => User, { description: 'Update mutable user attributes (department, clearance, status, …).' })
  updateUser(
    @CurrentUser() principal: AuthContext,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.usersService.update(principal.tenantId, input);
  }

  @Mutation(() => User, { description: 'Assign a manager, updating the org hierarchy closure table.' })
  assignManager(
    @CurrentUser() principal: AuthContext,
    @Args('input') input: AssignManagerInput,
  ): Promise<User> {
    return this.usersService.assignManager(principal.tenantId, input);
  }
}
