import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'An organizational unit within a tenant (supports nesting).' })
export class Department {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  parentDepartmentId!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
