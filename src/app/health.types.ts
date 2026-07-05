import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Liveness/readiness status of the service.' })
export class HealthStatus {
  @Field()
  status!: string;

  @Field()
  service!: string;

  @Field()
  timestamp!: string;
}
