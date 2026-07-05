import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A named RBAC role within a tenant.' })
export class Role {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
