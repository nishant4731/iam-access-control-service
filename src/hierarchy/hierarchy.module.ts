import { Module } from '@nestjs/common';
import { HierarchyResolver } from './hierarchy.resolver';
import { HierarchyService } from './hierarchy.service';

@Module({
  providers: [HierarchyService, HierarchyResolver],
  exports: [HierarchyService],
})
export class HierarchyModule {}
