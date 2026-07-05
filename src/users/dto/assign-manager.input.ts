import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class AssignManagerInput {
  @Field(() => String)
  @IsUUID()
  userId!: string;

  @Field(() => String)
  @IsUUID()
  managerId!: string;
}
