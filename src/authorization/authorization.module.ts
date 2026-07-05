import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PoliciesModule } from '../policies/policies.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AuthorizationResolver } from './authorization.resolver';
import { AuthorizationService } from './authorization.service';
import { AbacEvaluator } from './evaluators/abac.evaluator';
import { PolicyEvaluator } from './evaluators/policy.evaluator';
import { RbacEvaluator } from './evaluators/rbac.evaluator';
import { RebacEvaluator } from './evaluators/rebac.evaluator';
import { ResourceRepository } from './resource.repository';

/**
 * Wires the authorization engine together. Depends on the domain modules that
 * own the data the engine reads (tenants, users, permissions, policies) plus
 * the hierarchy (ReBAC) and audit modules.
 */
@Module({
  imports: [
    TenantsModule,
    UsersModule,
    PermissionsModule,
    PoliciesModule,
    HierarchyModule,
    AuditModule,
  ],
  providers: [
    AuthorizationService,
    AuthorizationResolver,
    ResourceRepository,
    RbacEvaluator,
    AbacEvaluator,
    RebacEvaluator,
    PolicyEvaluator,
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
