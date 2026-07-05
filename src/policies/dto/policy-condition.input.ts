import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ClearanceLevel, EmploymentStatus, RelationshipType } from '../../common/graphql/enums';

@InputType({ description: 'Typed condition clauses for a policy (all present clauses AND together).' })
export class PolicyConditionInput {
  @Field(() => [RelationshipType], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  relationships?: RelationshipType[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @Field(() => [EmploymentStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(EmploymentStatus, { each: true })
  employmentStatuses?: EmploymentStatus[];

  @Field(() => ClearanceLevel, { nullable: true })
  @IsOptional()
  @IsEnum(ClearanceLevel)
  maxSensitivity?: ClearanceLevel;

  @Field(() => ClearanceLevel, { nullable: true })
  @IsOptional()
  @IsEnum(ClearanceLevel)
  minClearance?: ClearanceLevel;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requirePermission?: boolean;
}
