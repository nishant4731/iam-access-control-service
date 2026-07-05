import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationArgs } from '../common/dto/pagination.args';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { CreateServiceIdentityInput } from './dto/create-service-identity.input';
import { ServiceIdentity, ServiceIdentityWithKey } from './entities/service-identity.entity';
import { ServiceIdentitiesService } from './service-identities.service';

@Resolver(() => ServiceIdentity)
export class ServiceIdentitiesResolver {
  constructor(private readonly service: ServiceIdentitiesService) {}

  @Query(() => [ServiceIdentity], { description: 'Service identities in the caller tenant.' })
  serviceIdentities(
    @CurrentUser() user: AuthContext,
    @Args() pagination: PaginationArgs,
  ): Promise<ServiceIdentity[]> {
    return this.service.findAll(user.tenantId, pagination);
  }

  @Mutation(() => ServiceIdentityWithKey, {
    description: 'Provision a service-to-service caller. The API key is returned only once.',
  })
  @Roles('Admin')
  @UseGuards(RolesGuard)
  createServiceIdentity(
    @CurrentUser() user: AuthContext,
    @Args('input') input: CreateServiceIdentityInput,
  ): Promise<ServiceIdentityWithKey> {
    return this.service.create(user.tenantId, input);
  }
}
