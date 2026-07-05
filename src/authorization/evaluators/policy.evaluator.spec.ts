import { AccessDecision, Policy, PolicyEffect } from '@prisma/client';
import { RelationshipType } from '../../common/enums/relationship-type.enum';
import { makeContext } from '../../../test/helpers/context.factory';
import { AbacEvaluator } from './abac.evaluator';
import { PolicyEvaluator } from './policy.evaluator';
import { RebacEvaluator } from './rebac.evaluator';

/** Builds a Policy record with the given effect + conditions. */
function policy(partial: Partial<Policy> & { name: string; effect: PolicyEffect }): Policy {
  return {
    id: partial.name,
    tenantId: 'tenant-x',
    name: partial.name,
    description: null,
    effect: partial.effect,
    action: partial.action ?? 'employee.performance.view',
    resourceType: partial.resourceType ?? 'employee',
    conditions: partial.conditions ?? {},
    priority: partial.priority ?? 100,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Policy;
}

describe('PolicyEvaluator (combining algorithm)', () => {
  // RebacEvaluator.satisfies is pure; AbacEvaluator is pure — use real instances.
  const evaluator = new PolicyEvaluator(new AbacEvaluator(), new RebacEvaluator({} as any));

  it('denies by default when no policy matches', () => {
    const result = evaluator.evaluate([], makeContext());
    expect(result.allowed).toBe(false);
    expect(result.effect).toBe(AccessDecision.DENY);
    expect(result.matchedPolicies).toEqual([]);
  });

  it('allows when a matching ALLOW policy applies and RBAC permission is held', () => {
    const ctx = makeContext({
      relationship: RelationshipType.DIRECT_MANAGER,
      hasRbacPermission: true,
    });
    const result = evaluator.evaluate(
      [policy({ name: 'allow', effect: PolicyEffect.ALLOW, conditions: { relationships: [RelationshipType.DIRECT_MANAGER], requirePermission: true } })],
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicies).toContain('allow');
  });

  it('does not match an ALLOW policy when the RBAC permission is missing', () => {
    const ctx = makeContext({ relationship: RelationshipType.DIRECT_MANAGER, hasRbacPermission: false });
    const result = evaluator.evaluate(
      [policy({ name: 'allow', effect: PolicyEffect.ALLOW, conditions: { relationships: [RelationshipType.DIRECT_MANAGER], requirePermission: true } })],
      ctx,
    );
    expect(result.allowed).toBe(false);
  });

  it('lets an explicit DENY override a matching ALLOW (deny-override semantics)', () => {
    const ctx = makeContext({ relationship: RelationshipType.NONE, hasRbacPermission: true });
    const result = evaluator.evaluate(
      [
        policy({ name: 'allow', effect: PolicyEffect.ALLOW, conditions: { requirePermission: true } }),
        policy({ name: 'deny', effect: PolicyEffect.DENY, conditions: { relationships: [RelationshipType.NONE] } }),
      ],
      ctx,
    );
    expect(result.allowed).toBe(false);
    expect(result.effect).toBe(AccessDecision.DENY);
    expect(result.matchedPolicies).toContain('deny');
  });
});
