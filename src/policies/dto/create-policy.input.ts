import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PolicyEffect } from '../../common/graphql/enums';
import { PolicyConditionInput } from './policy-condition.input';

@InputType()
export class CreatePolicyInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => PolicyEffect)
  @IsEnum(PolicyEffect)
  effect!: PolicyEffect;

  @Field({ description: 'Action this policy governs, or "*" for any.' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @Field({ nullable: true, defaultValue: '*', description: 'Resource type, or "*" for any.' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @Field(() => Int, { nullable: true, defaultValue: 100, description: 'Lower = evaluated first.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field(() => PolicyConditionInput)
  @ValidateNested()
  @Type(() => PolicyConditionInput)
  conditions!: PolicyConditionInput;
}
