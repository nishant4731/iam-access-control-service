import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { PaginationArgs } from '../common/dto/pagination.args';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { CreatePolicyInput } from './dto/create-policy.input';
import { Policy } from './entities/policy.entity';
import { PoliciesService } from './policies.service';

@Resolver(() => Policy)
export class PoliciesResolver {
  constructor(private readonly policiesService: PoliciesService) {}

  @Query(() => [Policy], { description: 'Policies in the caller tenant, priority order (paginated).' })
  policies(@CurrentUser() user: AuthContext, @Args() pagination: PaginationArgs): Promise<Policy[]> {
    return this.policiesService.findAll(user.tenantId, pagination);
  }

  @Mutation(() => Policy, {
    description: 'Create a configurable authorization policy (requires the policy.manage permission).',
  })
  @RequirePermission('policy.manage')
  @UseGuards(PermissionsGuard)
  createPolicy(
    @CurrentUser() user: AuthContext,
    @Args('input') input: CreatePolicyInput,
  ): Promise<Policy> {
    return this.policiesService.create(user.tenantId, input);
  }
}
