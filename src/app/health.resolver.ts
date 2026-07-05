import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import { HealthStatus } from './health.types';

@Resolver(() => HealthStatus)
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Query(() => HealthStatus, { description: 'Service + database health.' })
  health(): Promise<HealthStatus> {
    return this.healthService.readiness();
  }
}
