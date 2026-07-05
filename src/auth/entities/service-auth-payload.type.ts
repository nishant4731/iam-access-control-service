import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A short-lived service JWT issued in exchange for a service API key.' })
export class ServiceAuthPayload {
  @Field({ description: 'Service JWT (isService=true). Send as `Authorization: Bearer`.' })
  accessToken!: string;

  @Field()
  expiresIn!: string;

  @Field()
  tenantId!: string;

  @Field()
  serviceName!: string;
}
