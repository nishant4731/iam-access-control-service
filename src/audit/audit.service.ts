import { Injectable, Logger } from '@nestjs/common';
import { AccessAuditLog } from './entities/audit-log.entity';
import { AuditMapper } from './audit.mapper';
import { AuditRecordInput, AuditRepository } from './audit.repository';

/**
 * Writes and queries the immutable authorization audit trail. Every decision
 * made by the AuthorizationService is persisted here.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repository: AuditRepository) {}

  async record(input: AuditRecordInput): Promise<AccessAuditLog> {
    const model = await this.repository.create(input);
    this.logger.log({
      msg: 'access-decision',
      decisionId: input.decisionId,
      tenantId: input.tenantId,
      subjectUserId: input.subjectUserId,
      action: input.action,
      decision: input.decision,
      correlationId: input.correlationId,
    });
    return AuditMapper.toEntity(model);
  }

  async findMany(
    tenantId: string,
    take = 50,
    subjectUserId?: string,
  ): Promise<AccessAuditLog[]> {
    return AuditMapper.toEntities(await this.repository.findMany(tenantId, take, subjectUserId));
  }
}
