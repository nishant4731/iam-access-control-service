import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { CreateTenantInput } from './dto/create-tenant.input';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

@Resolver(() => Tenant)
export class TenantsResolver {
  constructor(private readonly tenantsService: TenantsService) {}

  @Query(() => Tenant, { description: "Returns the authenticated principal's own tenant." })
  tenant(@CurrentUser() user: AuthContext): Promise<Tenant> {
    return this.tenantsService.findById(user.tenantId);
  }

  @Mutation(() => Tenant, { description: 'Provision a new tenant (platform Admin only).' })
  @Roles('Admin')
  @UseGuards(RolesGuard)
  createTenant(@Args('input') input: CreateTenantInput): Promise<Tenant> {
    return this.tenantsService.create(input);
  }
}
