import { Field, Int, ObjectType } from '@nestjs/graphql';
import { RelationshipType } from '../../common/graphql/enums';

@ObjectType({ description: 'An edge in the org hierarchy closure table.' })
export class HierarchyEdge {
  @Field()
  userId!: string;

  @Field(() => Int, { description: 'Number of manager hops between the two users.' })
  depth!: number;
}

@ObjectType({ description: 'Materialised ancestors and descendants of a user (from the closure table).' })
export class OrganizationHierarchy {
  @Field()
  userId!: string;

  @Field(() => [HierarchyEdge], { description: 'Managers above the user (depth ascending).' })
  ancestors!: HierarchyEdge[];

  @Field(() => [HierarchyEdge], { description: 'Reports below the user (depth ascending).' })
  descendants!: HierarchyEdge[];
}

@ObjectType({ description: 'Resolved relationship of a subject to a target within the hierarchy.' })
export class RelationshipResult {
  @Field(() => RelationshipType)
  relationship!: RelationshipType;
}
