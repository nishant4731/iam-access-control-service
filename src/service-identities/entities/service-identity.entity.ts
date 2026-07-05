import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A service-to-service caller identity (never exposes its API key hash).' })
export class ServiceIdentity {
  @Field()
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field()
  enabled!: boolean;

  @Field()
  createdAt!: Date;
}

@ObjectType({
  description:
    'Returned once at creation time — the plaintext API key is shown only here and never stored.',
})
export class ServiceIdentityWithKey {
  @Field(() => ServiceIdentity)
  serviceIdentity!: ServiceIdentity;

  @Field({ description: 'Send this as the `x-api-key` header. Store it securely; it cannot be recovered.' })
  apiKey!: string;
}
