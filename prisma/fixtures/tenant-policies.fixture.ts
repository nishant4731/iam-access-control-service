import { Prisma, PolicyEffect } from '@prisma/client';

export interface TenantPolicyFixtureParams {
  tenantId: string;
  /** Department id used by the payroll policy (HR). */
  hrDepartmentId: string;
  /** Department id used by the expense policy (Finance). */
  financeDepartmentId: string;
}

/**
 * The canonical set of authorization policies that encode the acceptance
 * scenarios. Defined ONCE here and consumed by both `prisma/seed.ts` and the
 * e2e test, so the tests can never silently drift from what actually ships.
 *
 * Conditions are plain JSON interpreted by the PolicyEvaluator at runtime.
 */
export function tenantPolicies(
  p: TenantPolicyFixtureParams,
): Prisma.PolicyCreateManyInput[] {
  const { tenantId, hrDepartmentId, financeDepartmentId } = p;
  return [
    {
      tenantId,
      name: 'allow-performance-view',
      description: 'Managers/ancestors (and self) may view employee performance.',
      effect: PolicyEffect.ALLOW,
      action: 'employee.performance.view',
      resourceType: 'employee',
      priority: 100,
      conditions: {
        relationships: ['SELF', 'DIRECT_MANAGER', 'ANCESTOR'],
        maxSensitivity: 'CONFIDENTIAL',
        requirePermission: true,
      },
    },
    {
      tenantId,
      name: 'allow-salary-view',
      description: 'Managers/ancestors (and self) may view employee salary.',
      effect: PolicyEffect.ALLOW,
      action: 'employee.salary.view',
      resourceType: 'employee',
      priority: 100,
      conditions: {
        relationships: ['SELF', 'DIRECT_MANAGER', 'ANCESTOR'],
        maxSensitivity: 'CONFIDENTIAL',
        requirePermission: true,
      },
    },
    {
      tenantId,
      name: 'deny-salary-non-manager',
      description: 'Explicitly deny salary access to unrelated or sibling users.',
      effect: PolicyEffect.DENY,
      action: 'employee.salary.view',
      resourceType: 'employee',
      priority: 10,
      conditions: { relationships: ['SIBLING', 'NONE'] },
    },
    {
      tenantId,
      name: 'allow-payroll-view',
      description: 'HR department may view payroll (requires payroll.view permission).',
      effect: PolicyEffect.ALLOW,
      action: 'payroll.view',
      resourceType: 'payroll',
      priority: 100,
      conditions: {
        departments: [hrDepartmentId],
        maxSensitivity: 'CONFIDENTIAL',
        requirePermission: true,
      },
    },
    {
      tenantId,
      name: 'allow-expense-approve',
      description: 'Finance department may approve expenses.',
      effect: PolicyEffect.ALLOW,
      action: 'expense.approve',
      resourceType: 'expense',
      priority: 100,
      conditions: { departments: [financeDepartmentId], requirePermission: true },
    },
  ];
}
