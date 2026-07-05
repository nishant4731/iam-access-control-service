import { Injectable, Logger, Optional } from '@nestjs/common';
import { AccessDecision } from '@prisma/client';
import { trace as otelTrace } from '@opentelemetry/api';
import { RelationshipType } from '../common/enums/relationship-type.enum';
import { v4 as uuidv4 } from 'uuid';
import { MetricsService } from '../common/metrics/metrics.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsRepository } from '../permissions/permissions.repository';
import { PoliciesRepository } from '../policies/policies.repository';
import { TenantsRepository } from '../tenants/tenants.repository';
import { UsersRepository } from '../users/users.repository';
import {
  AuthorizationDecision,
  AuthorizationRequest,
  EvaluationContext,
  ResourceFacts,
  SubjectFacts,
} from './contracts/authorization.contracts';
import { AbacEvaluator } from './evaluators/abac.evaluator';
import { PolicyEvaluator } from './evaluators/policy.evaluator';
import { RbacEvaluator } from './evaluators/rbac.evaluator';
import { RebacEvaluator } from './evaluators/rebac.evaluator';
import { ResourceRepository } from './resource.repository';

/**
 * The centralized authorization engine. Every service delegates its access
 * decisions here via checkAccess(). It runs a fixed, auditable evaluation
 * pipeline and combines hybrid signals (RBAC + ABAC + ReBAC) through the
 * policy engine using deny-override semantics.
 *
 * Evaluation order:
 *   1 Validate tenant → 2 Validate subject → 3 Validate resource →
 *   4 RBAC → 5 ABAC → 6 ReBAC → 7 Policy evaluation →
 *   8 Persist audit log → 9 Return decision
 */
@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly policiesRepository: PoliciesRepository,
    private readonly resourceRepository: ResourceRepository,
    private readonly rbac: RbacEvaluator,
    private readonly abac: AbacEvaluator,
    private readonly rebac: RebacEvaluator,
    private readonly policyEvaluator: PolicyEvaluator,
    private readonly auditService: AuditService,
    // Optional so unit/e2e modules that don't register MetricsModule still work.
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  /**
   * Public entry point. Wraps the decision pipeline in an OpenTelemetry span
   * (a no-op unless a tracer provider is registered — see src/common/tracing).
   */
  async checkAccess(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const tracer = otelTrace.getTracer('iam-authorization');
    return tracer.startActiveSpan('authorization.checkAccess', async (span) => {
      span.setAttributes({
        'iam.tenant': request.tenantId,
        'iam.action': request.action,
        'iam.resourceType': request.resourceType,
      });
      try {
        const decision = await this.runPipeline(request);
        span.setAttribute('iam.decision', decision.effect);
        return decision;
      } finally {
        span.end();
      }
    });
  }

  private async runPipeline(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const startedAt = process.hrtime.bigint();
    const decisionId = uuidv4();
    const trace: string[] = [];

    // 1 — Validate tenant.
    const tenant = await this.tenantsRepository.findById(request.tenantId);
    if (!tenant || tenant.status !== 'ACTIVE') {
      return this.deny(request, decisionId, trace, startedAt, 'Tenant is invalid or not active');
    }
    trace.push(`Tenant "${tenant.slug}" validated (status ${tenant.status})`);

    // 2 — Validate subject (also enforces tenant membership).
    const subjectUser = await this.usersRepository.findById(request.tenantId, request.subjectUserId);
    if (!subjectUser) {
      return this.deny(
        request,
        decisionId,
        trace,
        startedAt,
        'Subject does not exist within this tenant',
      );
    }
    if (subjectUser.employmentStatus !== 'ACTIVE') {
      return this.deny(
        request,
        decisionId,
        trace,
        startedAt,
        `Subject employment status is ${subjectUser.employmentStatus}`,
      );
    }
    trace.push(`Subject "${subjectUser.id}" validated (${subjectUser.employmentStatus})`);

    // 3 — Validate resource (tenant-scoped; cross-tenant resources are not found).
    const resource = await this.resourceRepository.resolve(
      request.tenantId,
      request.resourceType,
      request.resourceId,
      request.resourceAttributes,
    );
    if (!resource) {
      return this.deny(
        request,
        decisionId,
        trace,
        startedAt,
        'Resource does not exist within this tenant',
      );
    }
    trace.push(
      `Resource "${resource.resourceType}:${resource.resourceId}" validated ` +
        `(owner ${resource.ownerUserId ?? 'none'}, sensitivity ${resource.sensitivity})`,
    );

    // Gather subject facts once, shared across evaluators.
    const permissionNames = await this.permissionsRepository.permissionNamesForUser(
      request.tenantId,
      subjectUser.id,
    );
    const subject: SubjectFacts = {
      userId: subjectUser.id,
      departmentId: subjectUser.departmentId,
      location: subjectUser.location,
      clearanceLevel: subjectUser.clearanceLevel,
      employmentStatus: subjectUser.employmentStatus,
      permissionNames,
      roleNames: [],
      attributes: request.subjectAttributes ?? {},
    };

    const ctx: EvaluationContext = {
      request,
      subject,
      resource,
      relationship: RelationshipType.NONE,
      hasRbacPermission: false,
      trace,
    };

    // 4 — RBAC.
    ctx.hasRbacPermission = this.rbac.evaluate(ctx);

    // 5 — ABAC (attribute facts are applied per-policy; note the subject facts).
    trace.push(
      `ABAC facts: department=${subject.departmentId ?? 'none'}, location=${subject.location ?? 'none'}, ` +
        `clearance=${subject.clearanceLevel}`,
    );

    // 6 — ReBAC (relationship via closure table).
    ctx.relationship = await this.rebac.resolve(ctx);

    // 7 — Policy evaluation (deny-override).
    const policies = await this.policiesRepository.findApplicable(
      request.tenantId,
      request.action,
      request.resourceType,
    );
    trace.push(`Loaded ${policies.length} applicable policy(ies)`);
    const decision = this.policyEvaluator.evaluate(policies, ctx);

    // 8 & 9 — Persist audit log and return.
    return this.finalize(
      request,
      decisionId,
      trace,
      startedAt,
      decision.effect,
      decision.reason,
      decision.matchedPolicies,
    );
  }

  /** Short-circuit denial helper for the validation stages. */
  private deny(
    request: AuthorizationRequest,
    decisionId: string,
    trace: string[],
    startedAt: bigint,
    reason: string,
  ): Promise<AuthorizationDecision> {
    trace.push(`DENY: ${reason}`);
    return this.finalize(request, decisionId, trace, startedAt, AccessDecision.DENY, reason, []);
  }

  private async finalize(
    request: AuthorizationRequest,
    decisionId: string,
    trace: string[],
    startedAt: bigint,
    effect: AccessDecision,
    reason: string,
    matchedPolicies: string[],
  ): Promise<AuthorizationDecision> {
    const latencyMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
    const allowed = effect === AccessDecision.ALLOW;

    this.metrics?.recordDecision(request.tenantId, effect, latencyMs);

    await this.auditService.record({
      tenantId: request.tenantId,
      decisionId,
      subjectUserId: request.subjectUserId,
      action: request.action,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      decision: effect,
      reason,
      matchedPolicies,
      evaluationTrace: trace,
      correlationId: request.correlationId ?? null,
      latencyMs,
    });

    this.logger.debug(`Decision ${decisionId}: ${effect} (${latencyMs}ms) — ${reason}`);

    return { decisionId, allowed, effect, reason, matchedPolicies, evaluationTrace: trace };
  }
}
