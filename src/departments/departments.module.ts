import { Module } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsResolver } from './departments.resolver';
import { DepartmentsService } from './departments.service';

@Module({
  providers: [DepartmentsService, DepartmentsRepository, DepartmentsResolver],
  exports: [DepartmentsService, DepartmentsRepository],
})
export class DepartmentsModule {}
