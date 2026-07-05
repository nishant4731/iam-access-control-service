import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClearanceLevel, EmploymentStatus, PolicyEffect } from '@prisma/client';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { RelationshipType } from '../src/common/enums/relationship-type.enum';
import { HierarchyService } from '../src/hierarchy/hierarchy.service';
import { PermissionsService } from '../src/permissions/permissions.service';
import { PoliciesModule } from '../src/policies/policies.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RolesModule } from '../src/roles/roles.module';
import { RolesService } from '../src/roles/roles.service';

/**
 * Aggressive/edge-case coverage that the happy-path e2e does not exercise:
 * live cache invalidation, closure-table re-parenting + cycle prevention,
 * ABAC denials through the full engine, and subject/tenant status checks.
 */
const T = 'tenant-hard';
const TS = 'tenant-hard-suspended';

describe('Authorization hardening (e2e)', () => {
  let moduleRef: TestingModule;
  let engine: AuthorizationService;
  let hierarchy: HierarchyService;
  let roles: RolesService;
  let permissions: PermissionsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthorizationModule,
        RolesModule,
        PoliciesModule,
      ],
    }).compile();
    await moduleRef.init();

    engine = moduleRef.get(AuthorizationService);
    hierarchy = moduleRef.get(HierarchyService);
    roles = moduleRef.get(RolesService);
    permissions = moduleRef.get(PermissionsService);
    prisma = moduleRef.get(PrismaService);

    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  async function cleanup(): Promise<void> {
    await prisma.tenant.deleteMany({ where: { id: { in: [T, TS] } } });
  }

  async function seed(): Promise<void> {
    await prisma.tenant.create({ data: { id: T, name: 'Hard', slug: T, status: 'ACTIVE' } });
    await prisma.department.createMany({
      data: [
        { id: `${T}-eng`, tenantId: T, name: 'Engineering' },
        { id: `${T}-sec`, tenantId: T, name: 'Security' },
      ],
    });

    // Users: a small tree (ceo → mgrA/mgrB; emp under mgrA), plus a reader,
    // a low-clearance user, and a suspended user.
    await prisma.user.createMany({
      data: [
        { id: `${T}-ceo`, tenantId: T, email: 'ceo@h.com', clearanceLevel: ClearanceLevel.TOP_SECRET, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-mgrA`, tenantId: T, email: 'mgra@h.com', clearanceLevel: ClearanceLevel.CONFIDENTIAL, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-mgrB`, tenantId: T, email: 'mgrb@h.com', clearanceLevel: ClearanceLevel.CONFIDENTIAL, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-emp`, tenantId: T, email: 'emp@h.com', clearanceLevel: ClearanceLevel.INTERNAL, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-reader`, tenantId: T, email: 'reader@h.com', departmentId: `${T}-eng`, clearanceLevel: ClearanceLevel.INTERNAL, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-reader2`, tenantId: T, email: 'reader2@h.com', clearanceLevel: ClearanceLevel.INTERNAL, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-lowclear`, tenantId: T, email: 'low@h.com', clearanceLevel: ClearanceLevel.INTERNAL, employmentStatus: EmploymentStatus.ACTIVE },
        { id: `${T}-suspended`, tenantId: T, email: 'susp@h.com', clearanceLevel: ClearanceLevel.CONFIDENTIAL, employmentStatus: EmploymentStatus.SUSPENDED },
      ],
    });
    for (const id of ['ceo', 'mgrA', 'mgrB', 'emp', 'reader', 'reader2', 'lowclear', 'suspended']) {
      await hierarchy.addNode(T, `${T}-${id}`);
    }
    await hierarchy.assignManager(T, `${T}-mgrA`, `${T}-ceo`);
    await hierarchy.assignManager(T, `${T}-mgrB`, `${T}-ceo`);
    await hierarchy.assignManager(T, `${T}-emp`, `${T}-mgrA`);

    // Roles / permissions for the RBAC-cache tests.
    await prisma.role.create({ data: { id: `${T}-role-reader`, tenantId: T, name: 'Reader' } });
    await prisma.permission.createMany({
      data: [
        { id: `${T}-perm-docread`, tenantId: T, name: 'doc.read', resource: 'doc', action: 'read' },
        { id: `${T}-perm-secret`, tenantId: T, name: 'secret.view', resource: 'doc', action: 'secret.view' },
      ],
    });

    // Resources.
    await prisma.resource.createMany({
      data: [
        { tenantId: T, externalId: 'doc-1', type: 'doc', sensitivity: ClearanceLevel.INTERNAL },
        { tenantId: T, externalId: 'secret-1', type: 'securedoc', sensitivity: ClearanceLevel.SECRET },
      ],
    });

    // Policies: doc.read (RBAC-only), secret.view (RBAC + ABAC clearance).
    await prisma.policy.createMany({
      data: [
        { tenantId: T, name: 'allow-doc-read', effect: PolicyEffect.ALLOW, action: 'doc.read', resourceType: 'doc', conditions: { requirePermission: true } },
        { tenantId: T, name: 'allow-secret-view', effect: PolicyEffect.ALLOW, action: 'secret.view', resourceType: 'securedoc', conditions: { requirePermission: true, maxSensitivity: 'TOP_SECRET' } },
      ],
    });
    // Give lowclear the secret.view permission but NOT the clearance.
    await prisma.userRole.create({ data: { tenantId: T, userId: `${T}-lowclear`, roleId: `${T}-role-reader` } });
    await prisma.rolePermission.create({ data: { tenantId: T, roleId: `${T}-role-reader`, permissionId: `${T}-perm-secret` } });

    // A separate suspended tenant.
    await prisma.tenant.create({ data: { id: TS, name: 'Suspended', slug: TS, status: 'SUSPENDED' } });
    await prisma.user.create({ data: { id: `${TS}-u`, tenantId: TS, email: 'u@s.com', clearanceLevel: ClearanceLevel.INTERNAL, employmentStatus: EmploymentStatus.ACTIVE } });
  }

  const check = (subjectUserId: string, action: string, resourceType: string, resourceId: string, tenantId = T) =>
    engine.checkAccess({ tenantId, subjectUserId, action, resourceType, resourceId });

  // -------------------------------------------------------------------------
  // Live cache invalidation
  // -------------------------------------------------------------------------
  it('assignPermission invalidates the permission cache (DENY → ALLOW without TTL wait)', async () => {
    // reader2 → Reader role, but Reader has no doc.read yet.
    await roles.assignRole(T, { userId: `${T}-reader2`, roleId: `${T}-role-reader` });

    const before = await check(`${T}-reader2`, 'doc.read', 'doc', 'doc-1');
    expect(before.allowed).toBe(false); // populates the (empty-ish) perm cache

    // Grant doc.read to the Reader role — must invalidate the cache.
    await permissions.assignPermission(T, {
      roleId: `${T}-role-reader`,
      permissionId: `${T}-perm-docread`,
    });

    const after = await check(`${T}-reader2`, 'doc.read', 'doc', 'doc-1');
    expect(after.allowed).toBe(true);
  });

  it('assignRole invalidates the permission cache for that user', async () => {
    // reader has no roles yet → DENY (and caches the empty permission set).
    const before = await check(`${T}-reader`, 'doc.read', 'doc', 'doc-1');
    expect(before.allowed).toBe(false);

    await roles.assignRole(T, { userId: `${T}-reader`, roleId: `${T}-role-reader` });

    const after = await check(`${T}-reader`, 'doc.read', 'doc', 'doc-1');
    expect(after.allowed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Closure-table re-parenting + cycle prevention
  // -------------------------------------------------------------------------
  it('re-parenting a user updates the closure table consistently', async () => {
    expect(await hierarchy.getRelationship(T, `${T}-mgrA`, `${T}-emp`)).toBe(RelationshipType.DIRECT_MANAGER);
    expect(await hierarchy.getRelationship(T, `${T}-mgrB`, `${T}-emp`)).toBe(RelationshipType.NONE);

    // Move emp from mgrA to mgrB.
    await hierarchy.assignManager(T, `${T}-emp`, `${T}-mgrB`);

    expect(await hierarchy.getRelationship(T, `${T}-mgrB`, `${T}-emp`)).toBe(RelationshipType.DIRECT_MANAGER);
    expect(await hierarchy.getRelationship(T, `${T}-mgrA`, `${T}-emp`)).toBe(RelationshipType.NONE);
    // CEO remains an ancestor through the new parent.
    expect(await hierarchy.getRelationship(T, `${T}-ceo`, `${T}-emp`)).toBe(RelationshipType.ANCESTOR);
  });

  it('rejects a manager assignment that would create a cycle', async () => {
    // ceo is an ancestor of emp; making ceo report to emp would cycle.
    await expect(hierarchy.assignManager(T, `${T}-ceo`, `${T}-emp`)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // -------------------------------------------------------------------------
  // ABAC / status denials through the full engine
  // -------------------------------------------------------------------------
  it('denies when subject clearance is below resource sensitivity (ABAC) despite holding the permission', async () => {
    const d = await check(`${T}-lowclear`, 'secret.view', 'securedoc', 'secret-1');
    // Decision is a correct deny-by-default; the ABAC-specific reason (why the
    // otherwise-matching ALLOW policy was rejected) is captured in the trace.
    expect(d.allowed).toBe(false);
    expect(d.evaluationTrace.join(' ').toLowerCase()).toMatch(/clearance.*insufficient/);
  });

  it('denies a suspended subject', async () => {
    const d = await check(`${T}-suspended`, 'doc.read', 'doc', 'doc-1');
    expect(d.allowed).toBe(false);
    expect(d.reason.toLowerCase()).toMatch(/employment|active/);
  });

  it('denies when the tenant is not active', async () => {
    const d = await engine.checkAccess({
      tenantId: TS,
      subjectUserId: `${TS}-u`,
      action: 'doc.read',
      resourceType: 'doc',
      resourceId: 'doc-1',
    });
    expect(d.allowed).toBe(false);
    expect(d.reason.toLowerCase()).toMatch(/tenant/);
  });
});
