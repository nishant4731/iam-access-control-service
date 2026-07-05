import { Injectable } from '@nestjs/common';
import { EvaluationContext } from '../contracts/authorization.contracts';

/**
 * Role-Based Access Control.
 *
 * Determines whether the subject holds a permission (via its roles) that grants
 * the requested action. Permission names are the fully-qualified action string
 * (e.g. "employee.performance.view"); a "*" permission grants everything.
 */
@Injectable()
export class RbacEvaluator {
  evaluate(ctx: EvaluationContext): boolean {
    const { permissionNames } = ctx.subject;
    const action = ctx.request.action;
    const resourceType = ctx.request.resourceType;

    const granted =
      permissionNames.includes('*') ||
      permissionNames.includes(action) ||
      permissionNames.includes(`${resourceType}.*`);

    ctx.trace.push(
      `RBAC: subject holds [${permissionNames.join(', ') || 'none'}] → ` +
        `${granted ? 'PERMISSION GRANTED' : 'no matching permission'} for "${action}"`,
    );
    return granted;
  }
}
