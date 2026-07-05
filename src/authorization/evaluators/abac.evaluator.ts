import { Injectable } from '@nestjs/common';
import { meetsClearance } from '../../common/utils/clearance.util';
import { PolicyCondition } from '../../policies/contracts/policy-condition.contract';
import { EvaluationContext } from '../contracts/authorization.contracts';

/**
 * Attribute-Based Access Control.
 *
 * Evaluates the attribute clauses of a policy condition against the subject and
 * resource facts: department, location, employment status, and the clearance /
 * sensitivity relationship. Returns a match result plus a human-readable reason
 * for the trace when a clause fails.
 */
@Injectable()
export class AbacEvaluator {
  /**
   * @returns `{ matched: true }` when all present attribute clauses pass, or
   *          `{ matched: false, reason }` describing the first failing clause.
   */
  evaluate(
    condition: PolicyCondition,
    ctx: EvaluationContext,
  ): { matched: boolean; reason?: string } {
    const { subject, resource } = ctx;

    if (condition.departments && condition.departments.length > 0) {
      const subjDept = subject.departmentId;
      if (!subjDept || !condition.departments.includes(subjDept)) {
        return {
          matched: false,
          reason: `ABAC: subject department "${subjDept ?? 'none'}" not in [${condition.departments.join(', ')}]`,
        };
      }
    }

    if (condition.locations && condition.locations.length > 0) {
      if (!subject.location || !condition.locations.includes(subject.location)) {
        return {
          matched: false,
          reason: `ABAC: subject location "${subject.location ?? 'none'}" not in [${condition.locations.join(', ')}]`,
        };
      }
    }

    if (condition.employmentStatuses && condition.employmentStatuses.length > 0) {
      if (!condition.employmentStatuses.includes(subject.employmentStatus)) {
        return {
          matched: false,
          reason: `ABAC: employment status "${subject.employmentStatus}" not permitted`,
        };
      }
    }

    if (condition.minClearance) {
      if (!meetsClearance(subject.clearanceLevel, condition.minClearance)) {
        return {
          matched: false,
          reason: `ABAC: subject clearance "${subject.clearanceLevel}" below required "${condition.minClearance}"`,
        };
      }
    }

    if (condition.maxSensitivity) {
      // Resource must be no more sensitive than the ceiling AND the subject's
      // clearance must be sufficient for the resource's sensitivity.
      if (!meetsClearance(condition.maxSensitivity, resource.sensitivity)) {
        return {
          matched: false,
          reason: `ABAC: resource sensitivity "${resource.sensitivity}" exceeds policy ceiling "${condition.maxSensitivity}"`,
        };
      }
      if (!meetsClearance(subject.clearanceLevel, resource.sensitivity)) {
        return {
          matched: false,
          reason: `ABAC: subject clearance "${subject.clearanceLevel}" insufficient for resource sensitivity "${resource.sensitivity}"`,
        };
      }
    }

    return { matched: true };
  }
}
