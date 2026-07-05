import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ClearanceLevel, EmploymentStatus } from '../../common/graphql/enums';

@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field({ nullable: true, description: 'If provided, the user can authenticate.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @Field(() => String, { nullable: true, description: 'Direct manager (edge in the org hierarchy).' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  designation?: string;

  @Field(() => ClearanceLevel, { nullable: true })
  @IsOptional()
  @IsEnum(ClearanceLevel)
  clearanceLevel?: ClearanceLevel;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  location?: string;

  @Field(() => EmploymentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;
}
