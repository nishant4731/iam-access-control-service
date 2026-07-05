import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

@InputType()
export class CreateDepartmentInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Parent department id for nested org units.',
  })
  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string;
}
