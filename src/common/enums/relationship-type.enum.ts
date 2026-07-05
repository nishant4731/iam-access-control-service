/**
 * Relationship of a subject to a resource owner within the org hierarchy.
 *
 * This is a COMPUTED value derived from the closure table at decision time; it
 * is never persisted, so it is a plain TypeScript enum rather than a Prisma
 * (database) enum. Ordered strongest → weakest for readability.
 */
export enum RelationshipType {
  SELF = 'SELF',
  DIRECT_MANAGER = 'DIRECT_MANAGER',
  ANCESTOR = 'ANCESTOR',
  SIBLING = 'SIBLING',
  NONE = 'NONE',
}
