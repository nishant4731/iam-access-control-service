import { ClearanceLevel, EmploymentStatus } from '@prisma/client';
import { RelationshipType } from '../../src/common/enums/relationship-type.enum';
import { EvaluationContext } from '../../src/authorization/contracts/authorization.contracts';

/**
 * Builds a fully-populated EvaluationContext for evaluator unit tests, with
 * sensible defaults that individual tests override.
 */
export function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const base: EvaluationContext = {
    request: {
      tenantId: 'tenant-x',
      subjectUserId: 'subject',
      action: 'employee.performance.view',
      resourceType: 'employee',
      resourceId: 'resource',
    },
    subject: {
      userId: 'subject',
      departmentId: 'dept-eng',
      location: 'HQ',
      clearanceLevel: ClearanceLevel.CONFIDENTIAL,
      employmentStatus: EmploymentStatus.ACTIVE,
      permissionNames: [],
      roleNames: [],
      attributes: {},
    },
    resource: {
      resourceType: 'employee',
      resourceId: 'resource',
      ownerUserId: 'owner',
      departmentId: 'dept-eng',
      sensitivity: ClearanceLevel.CONFIDENTIAL,
      attributes: {},
    },
    relationship: RelationshipType.NONE,
    hasRbacPermission: false,
    trace: [],
  };

  return {
    ...base,
    ...overrides,
    request: { ...base.request, ...overrides.request },
    subject: { ...base.subject, ...overrides.subject },
    resource: { ...base.resource, ...overrides.resource },
  };
}
