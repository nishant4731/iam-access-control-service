import { registerEnumType } from '@nestjs/graphql';
import {
  AccessDecision,
  ClearanceLevel,
  EmploymentStatus,
  PolicyEffect,
  TenantStatus,
} from '@prisma/client';
import { RelationshipType } from '../enums/relationship-type.enum';

/**
 * Re-export the domain enums as a single source of truth and register them with
 * the GraphQL code-first schema. Prisma-generated enums are used where the value
 * is persisted; RelationshipType is a computed enum defined in code. Importing
 * this module once (from the root GraphQL wiring) guarantees registration
 * happens before schema build.
 */
export {
  AccessDecision,
  ClearanceLevel,
  EmploymentStatus,
  PolicyEffect,
  RelationshipType,
  TenantStatus,
};

registerEnumType(TenantStatus, { name: 'TenantStatus' });
registerEnumType(EmploymentStatus, { name: 'EmploymentStatus' });
registerEnumType(ClearanceLevel, {
  name: 'ClearanceLevel',
  description: 'Ordered least→most sensitive: PUBLIC < INTERNAL < CONFIDENTIAL < SECRET < TOP_SECRET',
});
registerEnumType(PolicyEffect, { name: 'PolicyEffect' });
registerEnumType(RelationshipType, { name: 'RelationshipType' });
registerEnumType(AccessDecision, { name: 'AccessDecision' });
