import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import { HealthStatus } from './health.types';

/**
 * REST health endpoint consumed by the Docker/Compose HEALTHCHECK.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check(): HealthStatus {
    return this.healthService.liveness();
  }
}
