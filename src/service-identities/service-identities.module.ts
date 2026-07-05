import { Module } from '@nestjs/common';
import { ServiceIdentitiesRepository } from './service-identities.repository';
import { ServiceIdentitiesResolver } from './service-identities.resolver';
import { ServiceIdentitiesService } from './service-identities.service';

/**
 * Exports ServiceIdentitiesService so the global authentication guard can
 * validate `x-api-key` service credentials.
 */
@Module({
  providers: [ServiceIdentitiesService, ServiceIdentitiesRepository, ServiceIdentitiesResolver],
  exports: [ServiceIdentitiesService],
})
export class ServiceIdentitiesModule {}
