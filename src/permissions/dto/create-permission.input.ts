import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType()
export class CreatePermissionInput {
  @Field({ description: 'Canonical name, e.g. "employee.performance.view".' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Field({ description: 'Resource type, e.g. "employee".' })
  @IsString()
  @IsNotEmpty()
  resource!: string;

  @Field({ description: 'Action verb, e.g. "performance.view".' })
  @IsString()
  @IsNotEmpty()
  action!: string;
}
