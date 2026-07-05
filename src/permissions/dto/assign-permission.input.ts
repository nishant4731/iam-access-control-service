import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class AssignPermissionInput {
  @Field(() => String)
  @IsUUID()
  roleId!: string;

  @Field(() => String)
  @IsUUID()
  permissionId!: string;
}
