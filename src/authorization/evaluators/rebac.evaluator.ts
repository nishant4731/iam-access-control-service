import { Injectable } from '@nestjs/common';
import { RelationshipType } from '../../common/enums/relationship-type.enum';
import { HierarchyService } from '../../hierarchy/hierarchy.service';
import { EvaluationContext } from '../contracts/authorization.contracts';

/**
 * Relationship-Based Access Control.
 *
 * Resolves the subject's relationship to the resource owner using the
 * organization hierarchy CLOSURE TABLE (a single indexed lookup — never a
 * recursive walk):
 *   SELF | DIRECT_MANAGER | ANCESTOR | SIBLING | NONE
 */
@Injectable()
export class RebacEvaluator {
  constructor(private readonly hierarchyService: HierarchyService) {}

  async resolve(ctx: EvaluationContext): Promise<RelationshipType> {
    const ownerId = ctx.resource.ownerUserId;
    if (!ownerId) {
      ctx.trace.push('ReBAC: resource has no owner → relationship NONE');
      return RelationshipType.NONE;
    }

    const relationship = await this.hierarchyService.getRelationship(
      ctx.request.tenantId,
      ctx.subject.userId,
      ownerId,
    );

    ctx.trace.push(
      `ReBAC: subject "${ctx.subject.userId}" is ${relationship} of resource owner "${ownerId}"`,
    );
    return relationship;
  }

  /** True when the resolved relationship is one the policy allows. */
  satisfies(allowed: RelationshipType[] | undefined, actual: RelationshipType): boolean {
    if (!allowed || allowed.length === 0) {
      return true; // no relationship clause → not constrained
    }
    return allowed.includes(actual);
  }
}
