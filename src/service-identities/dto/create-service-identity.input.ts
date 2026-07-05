import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType()
export class CreateServiceIdentityInput {
  @Field({ description: 'Human-readable name of the calling service, e.g. "expense-service".' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
}
