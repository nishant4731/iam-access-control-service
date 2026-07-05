import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  ClearanceLevel,
  EmploymentStatus,
  PolicyEffect,
  RelationshipType,
} from '../../common/graphql/enums';

@ObjectType({ description: 'The typed condition clauses of a policy.' })
export class PolicyConditionType {
  @Field(() => [RelationshipType], { nullable: true })
  relationships?: RelationshipType[];

  @Field(() => [String], { nullable: true })
  departments?: string[];

  @Field(() => [String], { nullable: true })
  locations?: string[];

  @Field(() => [EmploymentStatus], { nullable: true })
  employmentStatuses?: EmploymentStatus[];

  @Field(() => ClearanceLevel, { nullable: true })
  maxSensitivity?: ClearanceLevel;

  @Field(() => ClearanceLevel, { nullable: true })
  minClearance?: ClearanceLevel;

  @Field({ nullable: true })
  requirePermission?: boolean;
}

@ObjectType({ description: 'A configurable authorization policy stored in PostgreSQL.' })
export class Policy {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => PolicyEffect)
  effect!: PolicyEffect;

  @Field()
  action!: string;

  @Field()
  resourceType!: string;

  @Field(() => Int)
  priority!: number;

  @Field()
  enabled!: boolean;

  @Field(() => PolicyConditionType)
  conditions!: PolicyConditionType;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
