import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class AssignRoleInput {
  @Field(() => String)
  @IsUUID()
  userId!: string;

  @Field(() => String)
  @IsUUID()
  roleId!: string;
}
