import { AccessAuditLog as AuditModel } from '@prisma/client';
import { AccessAuditLog } from './entities/audit-log.entity';

export class AuditMapper {
  static toEntity(model: AuditModel): AccessAuditLog {
    return {
      id: model.id,
      tenantId: model.tenantId,
      decisionId: model.decisionId,
      subjectUserId: model.subjectUserId,
      action: model.action,
      resourceType: model.resourceType,
      resourceId: model.resourceId,
      decision: model.decision,
      reason: model.reason,
      matchedPolicies: model.matchedPolicies,
      evaluationTrace: Array.isArray(model.evaluationTrace)
        ? (model.evaluationTrace as string[])
        : [],
      correlationId: model.correlationId,
      latencyMs: model.latencyMs,
      createdAt: model.createdAt,
    };
  }

  static toEntities(models: AuditModel[]): AccessAuditLog[] {
    return models.map((m) => AuditMapper.toEntity(m));
  }
}
