import { Module } from '@nestjs/common';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { UsersRepository } from './users.repository';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [HierarchyModule],
  providers: [UsersService, UsersRepository, UsersResolver],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
