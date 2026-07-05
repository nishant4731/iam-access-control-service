import { makeContext } from '../../../test/helpers/context.factory';
import { RbacEvaluator } from './rbac.evaluator';

describe('RbacEvaluator', () => {
  const evaluator = new RbacEvaluator();

  it('grants when the subject holds the exact action permission', () => {
    const ctx = makeContext({
      subject: { permissionNames: ['employee.performance.view'] } as any,
    });
    expect(evaluator.evaluate(ctx)).toBe(true);
  });

  it('denies when the subject holds no matching permission', () => {
    const ctx = makeContext({ subject: { permissionNames: ['payroll.view'] } as any });
    expect(evaluator.evaluate(ctx)).toBe(false);
  });

  it('grants via the global wildcard permission', () => {
    const ctx = makeContext({ subject: { permissionNames: ['*'] } as any });
    expect(evaluator.evaluate(ctx)).toBe(true);
  });

  it('grants via a resource-scoped wildcard permission', () => {
    const ctx = makeContext({
      request: { resourceType: 'employee', action: 'employee.performance.view' } as any,
      subject: { permissionNames: ['employee.*'] } as any,
    });
    expect(evaluator.evaluate(ctx)).toBe(true);
  });

  it('records a trace entry', () => {
    const ctx = makeContext({ subject: { permissionNames: ['*'] } as any });
    evaluator.evaluate(ctx);
    expect(ctx.trace.some((t) => t.startsWith('RBAC'))).toBe(true);
  });
});
