import { ClearanceLevel, EmploymentStatus } from '@prisma/client';
import { makeContext } from '../../../test/helpers/context.factory';
import { AbacEvaluator } from './abac.evaluator';

describe('AbacEvaluator', () => {
  const evaluator = new AbacEvaluator();

  it('matches when the subject department is in the allowed list', () => {
    const ctx = makeContext({ subject: { departmentId: 'dept-fin' } as any });
    expect(evaluator.evaluate({ departments: ['dept-fin'] }, ctx).matched).toBe(true);
  });

  it('fails when the subject department is not allowed', () => {
    const ctx = makeContext({ subject: { departmentId: 'dept-eng' } as any });
    const result = evaluator.evaluate({ departments: ['dept-fin'] }, ctx);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('department');
  });

  it('enforces location constraints', () => {
    const ctx = makeContext({ subject: { location: 'Remote' } as any });
    expect(evaluator.evaluate({ locations: ['HQ'] }, ctx).matched).toBe(false);
  });

  it('enforces employment status constraints', () => {
    const ctx = makeContext({
      subject: { employmentStatus: EmploymentStatus.SUSPENDED } as any,
    });
    expect(
      evaluator.evaluate({ employmentStatuses: [EmploymentStatus.ACTIVE] }, ctx).matched,
    ).toBe(false);
  });

  it('allows access when subject clearance meets resource sensitivity', () => {
    const ctx = makeContext({
      subject: { clearanceLevel: ClearanceLevel.SECRET } as any,
      resource: { sensitivity: ClearanceLevel.CONFIDENTIAL } as any,
    });
    expect(evaluator.evaluate({ maxSensitivity: ClearanceLevel.SECRET }, ctx).matched).toBe(true);
  });

  it('denies when subject clearance is below resource sensitivity', () => {
    const ctx = makeContext({
      subject: { clearanceLevel: ClearanceLevel.INTERNAL } as any,
      resource: { sensitivity: ClearanceLevel.CONFIDENTIAL } as any,
    });
    const result = evaluator.evaluate({ maxSensitivity: ClearanceLevel.CONFIDENTIAL }, ctx);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('insufficient');
  });

  it('denies when resource sensitivity exceeds the policy ceiling', () => {
    const ctx = makeContext({
      subject: { clearanceLevel: ClearanceLevel.TOP_SECRET } as any,
      resource: { sensitivity: ClearanceLevel.SECRET } as any,
    });
    expect(
      evaluator.evaluate({ maxSensitivity: ClearanceLevel.CONFIDENTIAL }, ctx).matched,
    ).toBe(false);
  });

  it('matches an empty condition (no attribute clauses)', () => {
    expect(evaluator.evaluate({}, makeContext()).matched).toBe(true);
  });
});
