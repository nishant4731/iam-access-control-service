import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ClearanceLevel, EmploymentStatus } from '@prisma/client';
import { tenantPolicies } from '../prisma/fixtures/tenant-policies.fixture';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { RelationshipType } from '../src/common/enums/relationship-type.enum';
import { HierarchyService } from '../src/hierarchy/hierarchy.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end authorization tests against a real PostgreSQL database.
 *
 * Seeds two isolated tenants under dedicated ids, then exercises the engine
 * across the 8 acceptance scenarios plus tenant isolation and the closure-table
 * relationship queries. Requires the database from docker-compose (Postgres on
 * localhost:5433) with migrations applied.
 */
const T = 'tenant-test';
const TB = 'tenant-test-b';

// Convenience user ids
const U = {
  ceo: 't-ceo',
  director: 't-director',
  mgrA: 't-mgr-a',
  mgrB: 't-mgr-b',
  empA: 't-emp-a',
  empB: 't-emp-b',
  fin: 't-fin',
  hr: 't-hr',
};

describe('Authorization Engine (e2e)', () => {
  let moduleRef: TestingModule;
  let engine: AuthorizationService;
  let hierarchy: HierarchyService;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthorizationModule],
    }).compile();

    await moduleRef.init();
    engine = moduleRef.get(AuthorizationService);
    hierarchy = moduleRef.get(HierarchyService);
    prisma = moduleRef.get(PrismaService);

    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  async function cleanup(): Promise<void> {
    await prisma.tenant.deleteMany({ where: { id: { in: [T, TB] } } });
  }

  async function seed(): Promise<void> {
    const passwordHash = null;

    // --- Tenant test ---
    await prisma.tenant.create({ data: { id: T, name: 'Test Co', slug: T, status: 'ACTIVE' } });
    const deptEng = `${T}-eng`;
    const deptFin = `${T}-fin`;
    const deptHr = `${T}-hr`;
    await prisma.department.createMany({
      data: [
        { id: deptEng, tenantId: T, name: 'Engineering' },
        { id: deptFin, tenantId: T, name: 'Finance' },
        { id: deptHr, tenantId: T, name: 'HR' },
      ],
    });

    const users = [
      { id: U.ceo, dept: null, clearance: ClearanceLevel.TOP_SECRET, loc: 'HQ' },
      { id: U.director, dept: deptEng, clearance: ClearanceLevel.SECRET, loc: 'HQ' },
      { id: U.mgrA, dept: deptEng, clearance: ClearanceLevel.CONFIDENTIAL, loc: 'HQ' },
      { id: U.mgrB, dept: deptEng, clearance: ClearanceLevel.CONFIDENTIAL, loc: 'HQ' },
      { id: U.empA, dept: deptEng, clearance: ClearanceLevel.INTERNAL, loc: 'HQ' },
      { id: U.empB, dept: deptEng, clearance: ClearanceLevel.INTERNAL, loc: 'HQ' },
      { id: U.fin, dept: deptFin, clearance: ClearanceLevel.CONFIDENTIAL, loc: 'HQ' },
      { id: U.hr, dept: deptHr, clearance: ClearanceLevel.CONFIDENTIAL, loc: 'HQ' },
    ];
    await prisma.user.createMany({
      data: users.map((u) => ({
        id: u.id,
        tenantId: T,
        email: `${u.id}@test.com`,
        passwordHash,
        departmentId: u.dept,
        clearanceLevel: u.clearance,
        location: u.loc,
        employmentStatus: EmploymentStatus.ACTIVE,
      })),
    });

    // Build the closure table via the real HierarchyService (top-down).
    for (const u of users) {
      await hierarchy.addNode(T, u.id);
    }
    await hierarchy.assignManager(T, U.director, U.ceo);
    await hierarchy.assignManager(T, U.mgrA, U.director);
    await hierarchy.assignManager(T, U.mgrB, U.director);
    await hierarchy.assignManager(T, U.empA, U.mgrA);
    await hierarchy.assignManager(T, U.empB, U.mgrB);
    await hierarchy.assignManager(T, U.fin, U.ceo);
    await hierarchy.assignManager(T, U.hr, U.ceo);

    // Roles + permissions
    const roleId = (name: string) => `${T}-role-${name.toLowerCase()}`;
    const roleNames = ['Executive', 'Director', 'Manager', 'Finance', 'HR', 'Employee'];
    await prisma.role.createMany({
      data: roleNames.map((name) => ({ id: roleId(name), tenantId: T, name })),
    });

    const perms = [
      { id: `${T}-p-perf`, name: 'employee.performance.view', resource: 'employee', action: 'performance.view' },
      { id: `${T}-p-salary`, name: 'employee.salary.view', resource: 'employee', action: 'salary.view' },
      { id: `${T}-p-payroll`, name: 'payroll.view', resource: 'payroll', action: 'view' },
      { id: `${T}-p-expense`, name: 'expense.approve', resource: 'expense', action: 'approve' },
    ];
    await prisma.permission.createMany({ data: perms.map((p) => ({ ...p, tenantId: T })) });
    const permId = (name: string) => perms.find((p) => p.name === name)!.id;

    const grant = async (role: string, permName: string) =>
      prisma.rolePermission.create({
        data: { tenantId: T, roleId: roleId(role), permissionId: permId(permName) },
      });
    await grant('Executive', 'employee.performance.view');
    await grant('Executive', 'employee.salary.view');
    await grant('Director', 'employee.performance.view');
    await grant('Director', 'employee.salary.view');
    await grant('Manager', 'employee.performance.view');
    await grant('Manager', 'employee.salary.view');
    await grant('Finance', 'expense.approve');
    await grant('HR', 'payroll.view');

    const assign = async (userId: string, role: string) =>
      prisma.userRole.create({ data: { tenantId: T, userId, roleId: roleId(role) } });
    await assign(U.ceo, 'Executive');
    await assign(U.director, 'Director');
    await assign(U.mgrA, 'Manager');
    await assign(U.mgrB, 'Manager');
    await assign(U.empA, 'Employee');
    await assign(U.empB, 'Employee');
    await assign(U.fin, 'Finance');
    await assign(U.hr, 'HR');

    // Resources
    await prisma.resource.createMany({
      data: [
        { tenantId: T, externalId: U.empA, type: 'employee', ownerUserId: U.empA, departmentId: deptEng, sensitivity: ClearanceLevel.CONFIDENTIAL },
        { tenantId: T, externalId: U.empB, type: 'employee', ownerUserId: U.empB, departmentId: deptEng, sensitivity: ClearanceLevel.CONFIDENTIAL },
        { tenantId: T, externalId: 'payroll-1', type: 'payroll', departmentId: deptHr, sensitivity: ClearanceLevel.CONFIDENTIAL },
        { tenantId: T, externalId: 'expense-1', type: 'expense', departmentId: deptFin, sensitivity: ClearanceLevel.INTERNAL },
      ],
    });

    // Policies — same shared fixture the seed uses (guards against drift).
    await prisma.policy.createMany({
      data: tenantPolicies({ tenantId: T, hrDepartmentId: deptHr, financeDepartmentId: deptFin }),
    });

    // --- Tenant test B (isolation) ---
    await prisma.tenant.create({ data: { id: TB, name: 'Test Co B', slug: TB, status: 'ACTIVE' } });
    await prisma.user.create({ data: { id: 'tb-emp', tenantId: TB, email: 'e@b.com', clearanceLevel: ClearanceLevel.INTERNAL, employmentStatus: EmploymentStatus.ACTIVE } });
    await hierarchy.addNode(TB, 'tb-emp');
    await prisma.resource.create({ data: { tenantId: TB, externalId: 'tb-emp', type: 'employee', ownerUserId: 'tb-emp', sensitivity: ClearanceLevel.CONFIDENTIAL } });
  }

  const check = (subjectUserId: string, action: string, resourceType: string, resourceId: string, tenantId = T) =>
    engine.checkAccess({ tenantId, subjectUserId, action, resourceType, resourceId });

  // -------------------------------------------------------------------------
  // Closure-table hierarchy relationships
  // -------------------------------------------------------------------------
  describe('Hierarchy (closure table)', () => {
    it('resolves SELF', async () => {
      expect(await hierarchy.getRelationship(T, U.empA, U.empA)).toBe(RelationshipType.SELF);
    });
    it('resolves DIRECT_MANAGER', async () => {
      expect(await hierarchy.getRelationship(T, U.mgrA, U.empA)).toBe(RelationshipType.DIRECT_MANAGER);
    });
    it('resolves ANCESTOR (skip-level)', async () => {
      expect(await hierarchy.getRelationship(T, U.director, U.empA)).toBe(RelationshipType.ANCESTOR);
      expect(await hierarchy.getRelationship(T, U.ceo, U.empA)).toBe(RelationshipType.ANCESTOR);
    });
    it('resolves SIBLING for managers under the same director', async () => {
      expect(await hierarchy.getRelationship(T, U.mgrA, U.mgrB)).toBe(RelationshipType.SIBLING);
    });
    it('resolves NONE for cross-branch employees', async () => {
      expect(await hierarchy.getRelationship(T, U.mgrA, U.empB)).toBe(RelationshipType.NONE);
    });
  });

  // -------------------------------------------------------------------------
  // The 8 acceptance scenarios
  // -------------------------------------------------------------------------
  describe('Acceptance scenarios', () => {
    it('S1: Manager A → view Employee A performance → ALLOW', async () => {
      const d = await check(U.mgrA, 'employee.performance.view', 'employee', U.empA);
      expect(d.allowed).toBe(true);
      expect(d.matchedPolicies).toContain('allow-performance-view');
      expect(d.decisionId).toBeTruthy();
    });

    it('S2: Manager A → view Employee B performance → DENY', async () => {
      const d = await check(U.mgrA, 'employee.performance.view', 'employee', U.empB);
      expect(d.allowed).toBe(false);
    });

    it('S3: Director → view Employee A performance → ALLOW', async () => {
      const d = await check(U.director, 'employee.performance.view', 'employee', U.empA);
      expect(d.allowed).toBe(true);
    });

    it('S4: CEO → view everyone → ALLOW', async () => {
      expect((await check(U.ceo, 'employee.performance.view', 'employee', U.empA)).allowed).toBe(true);
      expect((await check(U.ceo, 'employee.performance.view', 'employee', U.empB)).allowed).toBe(true);
      expect((await check(U.ceo, 'employee.salary.view', 'employee', U.empB)).allowed).toBe(true);
    });

    it('S5: Tenant test → view Tenant B resource → DENY (isolation)', async () => {
      const d = await check(U.ceo, 'employee.performance.view', 'employee', 'tb-emp');
      expect(d.allowed).toBe(false);
      expect(d.reason).toMatch(/tenant/i);
    });

    it('S6: HR → view Payroll → ALLOW (permission exists); Employee → DENY (no permission)', async () => {
      expect((await check(U.hr, 'payroll.view', 'payroll', 'payroll-1')).allowed).toBe(true);
      expect((await check(U.empA, 'payroll.view', 'payroll', 'payroll-1')).allowed).toBe(false);
    });

    it('S7: Finance → approve Expense → ALLOW', async () => {
      const d = await check(U.fin, 'expense.approve', 'expense', 'expense-1');
      expect(d.allowed).toBe(true);
    });

    it('S8: Employee A → view Employee B salary → DENY (explicit deny)', async () => {
      const d = await check(U.empA, 'employee.salary.view', 'employee', U.empB);
      expect(d.allowed).toBe(false);
      expect(d.matchedPolicies).toContain('deny-salary-non-manager');
    });
  });

  // -------------------------------------------------------------------------
  // Auditing
  // -------------------------------------------------------------------------
  it('persists an audit log for every decision', async () => {
    const before = await prisma.accessAuditLog.count({ where: { tenantId: T } });
    await check(U.mgrA, 'employee.performance.view', 'employee', U.empA);
    const after = await prisma.accessAuditLog.count({ where: { tenantId: T } });
    expect(after).toBe(before + 1);
  });
});
