import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A grantable permission (resource + action) within a tenant.' })
export class Permission {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field({ description: 'Canonical name, e.g. "employee.performance.view".' })
  name!: string;

  @Field({ description: 'Resource type, e.g. "employee".' })
  resource!: string;

  @Field({ description: 'Action verb, e.g. "performance.view".' })
  action!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
