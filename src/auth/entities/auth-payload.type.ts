import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Result of a successful authentication.' })
export class AuthPayload {
  @Field({ description: 'Signed JWT bearer token (short-lived)' })
  accessToken!: string;

  @Field({ description: 'Long-lived token used to obtain new access tokens via `refreshToken`.' })
  refreshToken!: string;

  @Field({ description: 'Access token lifetime, e.g. "1h"' })
  expiresIn!: string;

  @Field()
  userId!: string;

  @Field()
  tenantId!: string;

  @Field()
  email!: string;

  @Field(() => [String])
  roles!: string[];

  @Field(() => [String])
  permissions!: string[];
}
