import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache/cache.module';
import { PoliciesRepository } from './policies.repository';
import { PoliciesResolver } from './policies.resolver';
import { PoliciesService } from './policies.service';

@Module({
  imports: [CacheModule],
  providers: [PoliciesService, PoliciesRepository, PoliciesResolver],
  exports: [PoliciesService, PoliciesRepository],
})
export class PoliciesModule {}
