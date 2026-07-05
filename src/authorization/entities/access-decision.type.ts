import { Field, ObjectType } from '@nestjs/graphql';
import { AccessDecision as AccessDecisionEnum } from '../../common/graphql/enums';

@ObjectType({ description: 'The result of an authorization decision.' })
export class AccessDecisionResult {
  @Field({ description: 'True when the action is permitted.' })
  allowed!: boolean;

  @Field(() => AccessDecisionEnum)
  effect!: AccessDecisionEnum;

  @Field({ description: 'Human-readable justification for the decision.' })
  reason!: string;

  @Field(() => [String], { description: 'Names of the policies that matched.' })
  matchedPolicies!: string[];

  @Field({ description: 'Unique id correlating this decision to its audit record.' })
  decisionId!: string;

  @Field(() => [String], {
    description: 'Ordered evaluation trace across the RBAC/ABAC/ReBAC/policy stages.',
  })
  evaluationTrace!: string[];
}
