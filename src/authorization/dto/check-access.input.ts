import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType({ description: 'Request an authorization decision from the centralized engine.' })
export class CheckAccessInput {
  @Field({ description: 'Validated against the caller token by the TenantGuard.' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  subjectUserId!: string;

  @Field({ description: 'Fully-qualified action, e.g. "employee.performance.view".' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  @Field({ description: 'Resource type, e.g. "employee".' })
  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @Field({ nullable: true, description: 'Optional JSON string of extra resource attributes.' })
  @IsOptional()
  @IsString()
  resourceAttributes?: string;

  @Field({ nullable: true, description: 'Optional JSON string of extra subject attributes.' })
  @IsOptional()
  @IsString()
  subjectAttributes?: string;
}
