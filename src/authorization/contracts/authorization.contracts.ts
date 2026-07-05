import { AccessDecision, ClearanceLevel, EmploymentStatus } from '@prisma/client';
import { RelationshipType } from '../../common/enums/relationship-type.enum';

/**
 * Normalised authorization request handed to the engine. `tenantId` is always
 * the authenticated tenant, resolved server-side — never trusted from input.
 */
export interface AuthorizationRequest {
  tenantId: string;
  subjectUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceAttributes?: Record<string, unknown>;
  subjectAttributes?: Record<string, unknown>;
  correlationId?: string;
}

/** Facts about the subject, gathered once and shared by every evaluator. */
export interface SubjectFacts {
  userId: string;
  departmentId: string | null;
  location: string | null;
  clearanceLevel: ClearanceLevel;
  employmentStatus: EmploymentStatus;
  permissionNames: string[];
  roleNames: string[];
  attributes: Record<string, unknown>;
}

/** Facts about the resource being accessed. */
export interface ResourceFacts {
  resourceType: string;
  resourceId: string;
  ownerUserId: string | null;
  departmentId: string | null;
  sensitivity: ClearanceLevel;
  attributes: Record<string, unknown>;
}

/** Mutable evaluation context threaded through the pipeline. */
export interface EvaluationContext {
  request: AuthorizationRequest;
  subject: SubjectFacts;
  resource: ResourceFacts;
  relationship: RelationshipType;
  /** True when the subject holds an RBAC permission matching the action. */
  hasRbacPermission: boolean;
  trace: string[];
}

/** Final decision returned by the engine. */
export interface AuthorizationDecision {
  decisionId: string;
  allowed: boolean;
  effect: AccessDecision;
  reason: string;
  matchedPolicies: string[];
  evaluationTrace: string[];
}
