import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { OrganizationHierarchy } from './entities/hierarchy.types';
import { HierarchyService } from './hierarchy.service';

@Resolver(() => OrganizationHierarchy)
export class HierarchyResolver {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Query(() => OrganizationHierarchy, {
    description: 'Materialised ancestors and descendants of a user (closure table).',
  })
  async organizationHierarchy(
    @CurrentUser() user: AuthContext,
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<OrganizationHierarchy> {
    const [ancestors, descendants] = await Promise.all([
      this.hierarchyService.getAncestors(user.tenantId, userId),
      this.hierarchyService.getDescendants(user.tenantId, userId),
    ]);
    return { userId, ancestors, descendants };
  }
}
