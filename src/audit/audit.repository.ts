import { Injectable } from '@nestjs/common';
import { AccessAuditLog, AccessDecision, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditRecordInput {
  tenantId: string;
  decisionId: string;
  subjectUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  decision: AccessDecision;
  reason: string;
  matchedPolicies: string[];
  evaluationTrace: string[];
  correlationId?: string | null;
  latencyMs?: number | null;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: AuditRecordInput): Promise<AccessAuditLog> {
    return this.prisma.accessAuditLog.create({
      data: {
        tenantId: input.tenantId,
        decisionId: input.decisionId,
        subjectUserId: input.subjectUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        decision: input.decision,
        reason: input.reason,
        matchedPolicies: input.matchedPolicies,
        evaluationTrace: input.evaluationTrace as Prisma.InputJsonValue,
        correlationId: input.correlationId ?? null,
        latencyMs: input.latencyMs ?? null,
      },
    });
  }

  findMany(tenantId: string, take = 50, subjectUserId?: string): Promise<AccessAuditLog[]> {
    return this.prisma.accessAuditLog.findMany({
      where: { tenantId, ...(subjectUserId ? { subjectUserId } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
