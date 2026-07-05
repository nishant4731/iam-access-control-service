import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache/cache.module';
import { UsersModule } from '../users/users.module';
import { RolesRepository } from './roles.repository';
import { RolesResolver } from './roles.resolver';
import { RolesService } from './roles.service';

@Module({
  imports: [UsersModule, CacheModule],
  providers: [RolesService, RolesRepository, RolesResolver],
  exports: [RolesService, RolesRepository],
})
export class RolesModule {}
