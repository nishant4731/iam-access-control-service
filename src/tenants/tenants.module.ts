import { Module } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { TenantsResolver } from './tenants.resolver';
import { TenantsService } from './tenants.service';

@Module({
  providers: [TenantsService, TenantsRepository, TenantsResolver],
  exports: [TenantsService, TenantsRepository],
})
export class TenantsModule {}
