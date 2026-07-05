import { Injectable } from '@nestjs/common';
import { AccessDecision, Policy, PolicyEffect } from '@prisma/client';
import { PolicyCondition } from '../../policies/contracts/policy-condition.contract';
import { EvaluationContext } from '../contracts/authorization.contracts';
import { AbacEvaluator } from './abac.evaluator';
import { RebacEvaluator } from './rebac.evaluator';

export interface PolicyDecision {
  allowed: boolean;
  effect: AccessDecision;
  reason: string;
  matchedPolicies: string[];
}

/**
 * The policy combining algorithm — AWS IAM / Azure-style semantics:
 *
 *   1. Deny by default.
 *   2. Any matching explicit DENY policy overrides everything.
 *   3. Otherwise, a matching ALLOW policy grants access.
 *
 * A policy MATCHES when its ReBAC (relationship), ABAC (attribute) and RBAC
 * (requirePermission) clauses all pass. Policies are pure data loaded from
 * PostgreSQL — this evaluator contains no hardcoded business rules.
 */
@Injectable()
export class PolicyEvaluator {
  constructor(
    private readonly abac: AbacEvaluator,
    private readonly rebac: RebacEvaluator,
  ) {}

  evaluate(policies: Policy[], ctx: EvaluationContext): PolicyDecision {
    const matchedAllow: string[] = [];
    const matchedDeny: string[] = [];

    for (const policy of policies) {
      const condition = (policy.conditions ?? {}) as PolicyCondition;
      const result = this.matches(policy, condition, ctx);
      if (result.matched) {
        ctx.trace.push(`Policy "${policy.name}" [${policy.effect}] MATCHED`);
        (policy.effect === PolicyEffect.DENY ? matchedDeny : matchedAllow).push(policy.name);
      } else {
        ctx.trace.push(`Policy "${policy.name}" [${policy.effect}] not applicable: ${result.reason}`);
      }
    }

    if (matchedDeny.length > 0) {
      return {
        allowed: false,
        effect: AccessDecision.DENY,
        reason: `Explicit DENY by policy: ${matchedDeny.join(', ')}`,
        matchedPolicies: [...matchedDeny, ...matchedAllow],
      };
    }

    if (matchedAllow.length > 0) {
      return {
        allowed: true,
        effect: AccessDecision.ALLOW,
        reason: `Allowed by policy: ${matchedAllow.join(', ')}`,
        matchedPolicies: matchedAllow,
      };
    }

    return {
      allowed: false,
      effect: AccessDecision.DENY,
      reason: 'No matching ALLOW policy — denied by default',
      matchedPolicies: [],
    };
  }

  private matches(
    policy: Policy,
    condition: PolicyCondition,
    ctx: EvaluationContext,
  ): { matched: boolean; reason?: string } {
    // ReBAC clause
    if (!this.rebac.satisfies(condition.relationships, ctx.relationship)) {
      return {
        matched: false,
        reason: `relationship "${ctx.relationship}" not in [${condition.relationships?.join(', ')}]`,
      };
    }

    // ABAC clauses
    const abac = this.abac.evaluate(condition, ctx);
    if (!abac.matched) {
      return { matched: false, reason: abac.reason };
    }

    // RBAC clause — ALLOW policies require a matching permission by default;
    // DENY policies do not (a denial should not hinge on the subject's grants).
    const requirePermission = condition.requirePermission ?? policy.effect === PolicyEffect.ALLOW;
    if (requirePermission && !ctx.hasRbacPermission) {
      return { matched: false, reason: `missing RBAC permission for "${ctx.request.action}"` };
    }

    return { matched: true };
  }
}
