import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache/cache.module';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsResolver } from './permissions.resolver';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [CacheModule],
  providers: [PermissionsService, PermissionsRepository, PermissionsResolver],
  exports: [PermissionsService, PermissionsRepository],
})
export class PermissionsModule {}
