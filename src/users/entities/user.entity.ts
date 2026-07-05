import { Field, ObjectType } from '@nestjs/graphql';
import { ClearanceLevel, EmploymentStatus } from '../../common/graphql/enums';

@ObjectType({ description: 'A member of a tenant organization. Never exposes the password hash.' })
export class User {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field(() => String, { nullable: true })
  departmentId!: string | null;

  @Field(() => String, { nullable: true })
  managerId!: string | null;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  designation!: string | null;

  @Field(() => ClearanceLevel)
  clearanceLevel!: ClearanceLevel;

  @Field(() => String, { nullable: true })
  location!: string | null;

  @Field(() => EmploymentStatus)
  employmentStatus!: EmploymentStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
