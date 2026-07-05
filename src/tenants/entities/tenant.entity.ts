import { Field, ObjectType } from '@nestjs/graphql';
import { TenantStatus } from '../../common/graphql/enums';

@ObjectType({ description: 'An isolated customer organization.' })
export class Tenant {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field({ description: 'URL-safe unique identifier used at login.' })
  slug!: string;

  @Field(() => TenantStatus)
  status!: TenantStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
