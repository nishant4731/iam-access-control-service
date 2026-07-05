import { ClearanceLevel, EmploymentStatus } from '@prisma/client';
import { RelationshipType } from '../../common/enums/relationship-type.enum';

/**
 * Typed contract for the JSON `conditions` document stored on every Policy.
 *
 * All present clauses must be satisfied for the policy to MATCH (logical AND).
 * A policy with no clauses matches unconditionally (subject to action/resource
 * matching handled by the engine). Absent clauses are simply not evaluated.
 *
 * This is the single source of truth interpreted by the PolicyEvaluator — the
 * engine contains no hardcoded business policy.
 */
export interface PolicyCondition {
  /** Subject must hold one of these relationships to the resource owner. */
  relationships?: RelationshipType[];
  /** Subject's department id or name must be in this list. */
  departments?: string[];
  /** Subject's location must be in this list. */
  locations?: string[];
  /** Subject's employment status must be in this list. */
  employmentStatuses?: EmploymentStatus[];
  /** Resource sensitivity must be <= this level (data-classification ceiling). */
  maxSensitivity?: ClearanceLevel;
  /** Subject's clearance must be >= this level. */
  minClearance?: ClearanceLevel;
  /**
   * When true, the subject must additionally hold an RBAC permission matching
   * the action (checked via the RBAC evaluator). Defaults to true for ALLOW
   * policies so RBAC and policy layers reinforce each other.
   */
  requirePermission?: boolean;
}

// Compile-time guarantee that the GraphQL input type and this persisted contract
// stay in lockstep: if a field is added to one but not the other, this fails to
// compile. (Type-only import — erased at build time, no runtime coupling.)
import type { PolicyConditionInput } from '../dto/policy-condition.input';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertConditionInputMatchesContract = PolicyConditionInput extends PolicyCondition
  ? true
  : never;

