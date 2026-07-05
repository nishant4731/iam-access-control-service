import { Field, Int, ObjectType } from '@nestjs/graphql';
import { AccessDecision } from '../../common/graphql/enums';

@ObjectType({ description: 'Immutable record of a single authorization decision.' })
export class AccessAuditLog {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field({ description: 'Correlates to the decisionId returned by checkAccess.' })
  decisionId!: string;

  @Field(() => String, { nullable: true })
  subjectUserId!: string | null;

  @Field()
  action!: string;

  @Field()
  resourceType!: string;

  @Field(() => String, { nullable: true })
  resourceId!: string | null;

  @Field(() => AccessDecision)
  decision!: AccessDecision;

  @Field()
  reason!: string;

  @Field(() => [String])
  matchedPolicies!: string[];

  @Field(() => [String], { description: 'Ordered evaluation trace (RBAC/ABAC/ReBAC/policy).' })
  evaluationTrace!: string[];

  @Field(() => String, { nullable: true })
  correlationId!: string | null;

  @Field(() => Int, { nullable: true })
  latencyMs!: number | null;

  @Field()
  createdAt!: Date;
}
