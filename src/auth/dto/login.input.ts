import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class LoginInput {
  @Field({ description: 'Tenant slug the user belongs to (e.g. "tenant-a")' })
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  password!: string;
}
