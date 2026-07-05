import { Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditResolver } from './audit.resolver';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService, AuditRepository, AuditResolver],
  exports: [AuditService],
})
export class AuditModule {}
