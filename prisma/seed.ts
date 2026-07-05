/* eslint-disable no-console */
/**
 * Deterministic, idempotent seed for the IAM Access Control Service.
 *
 * Creates two fully independent tenants:
 *   • Tenant A — a realistic org (CEO → Director → Managers → Employees, plus
 *     Finance & HR admins) with roles, permissions, resources and the policies
 *     that encode the 8 acceptance scenarios.
 *   • Tenant B — a separate organization, used to prove tenant isolation.
 *
 * Human-readable ids are used so the README / Playground examples are
 * copy-paste runnable (e.g. subjectUserId "manager-a", resourceId "employee-a").
 *
 * This file is compiled standalone (see Dockerfile) and therefore imports only
 * from @prisma/client and bcryptjs — no application code.
 */
import { ClearanceLevel, EmploymentStatus, PolicyEffect, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { tenantPolicies } from './fixtures/tenant-policies.fixture';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

interface SeedUser {
  id: string;
  email: string;
  designation: string;
  departmentId: string | null;
  managerId: string | null;
  clearanceLevel: ClearanceLevel;
  location: string;
  roles: string[];
}

/** Builds closure-table rows from the manager edges (seed-time only). */
function buildClosureRows(
  tenantId: string,
  users: { id: string; managerId: string | null }[],
): { tenantId: string; ancestorUserId: string; descendantUserId: string; depth: number }[] {
  const managerOf = new Map(users.map((u) => [u.id, u.managerId]));
  const rows = [] as {
    tenantId: string;
    ancestorUserId: string;
    descendantUserId: string;
    depth: number;
  }[];

  for (const u of users) {
    rows.push({ tenantId, ancestorUserId: u.id, descendantUserId: u.id, depth: 0 });
    let cur = managerOf.get(u.id) ?? null;
    let depth = 1;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      rows.push({ tenantId, ancestorUserId: cur, descendantUserId: u.id, depth });
      cur = managerOf.get(cur) ?? null;
      depth += 1;
    }
  }
  return rows;
}

async function seedTenantA(passwordHash: string): Promise<void> {
  const tenantId = 'tenant-a';

  await prisma.tenant.create({
    data: { id: tenantId, name: 'Acme Corporation', slug: 'tenant-a', status: 'ACTIVE' },
  });

  // Departments
  const deptEng = 'dept-eng-a';
  const deptFin = 'dept-fin-a';
  const deptHr = 'dept-hr-a';
  await prisma.department.createMany({
    data: [
      { id: deptEng, tenantId, name: 'Engineering', parentDepartmentId: null },
      { id: deptFin, tenantId, name: 'Finance', parentDepartmentId: null },
      { id: deptHr, tenantId, name: 'Human Resources', parentDepartmentId: null },
    ],
  });

  // Users (org chart)
  const users: SeedUser[] = [
    { id: 'ceo-a', email: 'ceo@tenant-a.com', designation: 'CEO', departmentId: null, managerId: null, clearanceLevel: ClearanceLevel.TOP_SECRET, location: 'HQ', roles: ['Admin', 'Executive'] },
    { id: 'director-a', email: 'director@tenant-a.com', designation: 'Engineering Director', departmentId: deptEng, managerId: 'ceo-a', clearanceLevel: ClearanceLevel.SECRET, location: 'HQ', roles: ['Director'] },
    { id: 'manager-a', email: 'manager-a@tenant-a.com', designation: 'Engineering Manager A', departmentId: deptEng, managerId: 'director-a', clearanceLevel: ClearanceLevel.CONFIDENTIAL, location: 'HQ', roles: ['Manager'] },
    { id: 'manager-b', email: 'manager-b@tenant-a.com', designation: 'Engineering Manager B', departmentId: deptEng, managerId: 'director-a', clearanceLevel: ClearanceLevel.CONFIDENTIAL, location: 'Remote', roles: ['Manager'] },
    { id: 'employee-a', email: 'employee-a@tenant-a.com', designation: 'Software Engineer', departmentId: deptEng, managerId: 'manager-a', clearanceLevel: ClearanceLevel.INTERNAL, location: 'HQ', roles: ['Employee'] },
    { id: 'employee-b', email: 'employee-b@tenant-a.com', designation: 'Software Engineer', departmentId: deptEng, managerId: 'manager-b', clearanceLevel: ClearanceLevel.INTERNAL, location: 'Remote', roles: ['Employee'] },
    { id: 'finance-admin-a', email: 'finance@tenant-a.com', designation: 'Finance Administrator', departmentId: deptFin, managerId: 'ceo-a', clearanceLevel: ClearanceLevel.CONFIDENTIAL, location: 'HQ', roles: ['Finance'] },
    { id: 'hr-admin-a', email: 'hr@tenant-a.com', designation: 'HR Administrator', departmentId: deptHr, managerId: 'ceo-a', clearanceLevel: ClearanceLevel.CONFIDENTIAL, location: 'HQ', roles: ['HR'] },
  ];

  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      tenantId,
      email: u.email,
      passwordHash,
      designation: u.designation,
      departmentId: u.departmentId,
      managerId: u.managerId,
      clearanceLevel: u.clearanceLevel,
      location: u.location,
      employmentStatus: EmploymentStatus.ACTIVE,
    })),
  });

  // Organization hierarchy closure table
  await prisma.organizationHierarchyClosure.createMany({
    data: buildClosureRows(
      tenantId,
      users.map((u) => ({ id: u.id, managerId: u.managerId })),
    ),
  });

  // Roles
  const roleDefs = [
    { id: 'role-admin-a', name: 'Admin', description: 'Platform administrator' },
    { id: 'role-exec-a', name: 'Executive', description: 'C-level executive' },
    { id: 'role-director-a', name: 'Director', description: 'Department director' },
    { id: 'role-manager-a', name: 'Manager', description: 'People manager' },
    { id: 'role-finance-a', name: 'Finance', description: 'Finance department' },
    { id: 'role-hr-a', name: 'HR', description: 'Human resources department' },
    { id: 'role-employee-a', name: 'Employee', description: 'Standard employee' },
  ];
  await prisma.role.createMany({
    data: roleDefs.map((r) => ({ id: r.id, tenantId, name: r.name, description: r.description })),
  });
  const roleIdByName = new Map(roleDefs.map((r) => [r.name, r.id]));

  // Permissions (name is the fully-qualified action)
  const permDefs = [
    { id: 'perm-perf-a', name: 'employee.performance.view', resource: 'employee', action: 'performance.view' },
    { id: 'perm-salary-a', name: 'employee.salary.view', resource: 'employee', action: 'salary.view' },
    { id: 'perm-payroll-a', name: 'payroll.view', resource: 'payroll', action: 'view' },
    { id: 'perm-expense-a', name: 'expense.approve', resource: 'expense', action: 'approve' },
    { id: 'perm-wildcard-a', name: '*', resource: '*', action: '*' },
  ];
  await prisma.permission.createMany({
    data: permDefs.map((p) => ({ id: p.id, tenantId, name: p.name, resource: p.resource, action: p.action })),
  });
  const permIdByName = new Map(permDefs.map((p) => [p.name, p.id]));

  // Role → permission grants
  const grants: Record<string, string[]> = {
    Admin: ['*'],
    Executive: ['employee.performance.view', 'employee.salary.view', 'payroll.view', 'expense.approve'],
    Director: ['employee.performance.view', 'employee.salary.view'],
    Manager: ['employee.performance.view', 'employee.salary.view'],
    Finance: ['expense.approve'],
    HR: ['payroll.view'],
    Employee: [],
  };
  const rolePermRows: { tenantId: string; roleId: string; permissionId: string }[] = [];
  for (const [roleName, perms] of Object.entries(grants)) {
    for (const permName of perms) {
      rolePermRows.push({
        tenantId,
        roleId: roleIdByName.get(roleName)!,
        permissionId: permIdByName.get(permName)!,
      });
    }
  }
  await prisma.rolePermission.createMany({ data: rolePermRows });

  // User → role assignments
  const userRoleRows: { tenantId: string; userId: string; roleId: string }[] = [];
  for (const u of users) {
    for (const roleName of u.roles) {
      userRoleRows.push({ tenantId, userId: u.id, roleId: roleIdByName.get(roleName)! });
    }
  }
  await prisma.userRole.createMany({ data: userRoleRows });

  // Resources
  await prisma.resource.createMany({
    data: [
      { tenantId, externalId: 'employee-a', type: 'employee', ownerUserId: 'employee-a', departmentId: deptEng, sensitivity: ClearanceLevel.CONFIDENTIAL },
      { tenantId, externalId: 'employee-b', type: 'employee', ownerUserId: 'employee-b', departmentId: deptEng, sensitivity: ClearanceLevel.CONFIDENTIAL },
      { tenantId, externalId: 'payroll-june', type: 'payroll', ownerUserId: null, departmentId: deptHr, sensitivity: ClearanceLevel.CONFIDENTIAL },
      { tenantId, externalId: 'expense-1', type: 'expense', ownerUserId: null, departmentId: deptFin, sensitivity: ClearanceLevel.INTERNAL },
    ],
  });

  // Policies (data-driven; nothing hardcoded in the engine). Shared fixture keeps
  // the seed and the e2e tests in lockstep.
  await prisma.policy.createMany({
    data: tenantPolicies({ tenantId, hrDepartmentId: deptHr, financeDepartmentId: deptFin }),
  });

  // Demo service identity (service-to-service caller) with a KNOWN api key so the
  // README/Playground examples are runnable. Rotate/remove outside demos.
  const serviceSecret = 'demo-secret-please-rotate';
  await prisma.serviceIdentity.create({
    data: {
      id: 'svc-expense-a',
      tenantId,
      name: 'expense-service',
      apiKeyHash: await bcrypt.hash(serviceSecret, 10),
      enabled: true,
    },
  });

  console.log('  ✓ Tenant A seeded (8 users, 7 roles, 5 permissions, 5 policies, 4 resources, 1 service identity)');
  console.log(`    Demo service API key (x-api-key): svc-expense-a.${serviceSecret}`);
}

async function seedTenantB(passwordHash: string): Promise<void> {
  const tenantId = 'tenant-b';

  await prisma.tenant.create({
    data: { id: tenantId, name: 'Globex Inc', slug: 'tenant-b', status: 'ACTIVE' },
  });

  const deptEng = 'dept-eng-b';
  await prisma.department.create({ data: { id: deptEng, tenantId, name: 'Engineering' } });

  const users = [
    { id: 'ceo-b', email: 'ceo@tenant-b.com', designation: 'CEO', departmentId: null, managerId: null as string | null, clearance: ClearanceLevel.TOP_SECRET, roles: ['Admin', 'Executive'] },
    { id: 'employee-b1', email: 'employee1@tenant-b.com', designation: 'Engineer', departmentId: deptEng, managerId: 'ceo-b', clearance: ClearanceLevel.INTERNAL, roles: ['Employee'] },
  ];
  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      tenantId,
      email: u.email,
      passwordHash,
      designation: u.designation,
      departmentId: u.departmentId,
      managerId: u.managerId,
      clearanceLevel: u.clearance,
      location: 'HQ',
      employmentStatus: EmploymentStatus.ACTIVE,
    })),
  });
  await prisma.organizationHierarchyClosure.createMany({
    data: buildClosureRows(
      tenantId,
      users.map((u) => ({ id: u.id, managerId: u.managerId })),
    ),
  });

  const roleDefs = [
    { id: 'role-admin-b', name: 'Admin' },
    { id: 'role-exec-b', name: 'Executive' },
    { id: 'role-employee-b', name: 'Employee' },
  ];
  await prisma.role.createMany({ data: roleDefs.map((r) => ({ id: r.id, tenantId, name: r.name })) });
  const roleIdByName = new Map(roleDefs.map((r) => [r.name, r.id]));

  await prisma.permission.createMany({
    data: [
      { id: 'perm-perf-b', tenantId, name: 'employee.performance.view', resource: 'employee', action: 'performance.view' },
      { id: 'perm-wildcard-b', tenantId, name: '*', resource: '*', action: '*' },
    ],
  });
  await prisma.rolePermission.createMany({
    data: [
      { tenantId, roleId: roleIdByName.get('Admin')!, permissionId: 'perm-wildcard-b' },
      { tenantId, roleId: roleIdByName.get('Executive')!, permissionId: 'perm-perf-b' },
    ],
  });
  await prisma.userRole.createMany({
    data: [
      { tenantId, userId: 'ceo-b', roleId: roleIdByName.get('Admin')! },
      { tenantId, userId: 'ceo-b', roleId: roleIdByName.get('Executive')! },
      { tenantId, userId: 'employee-b1', roleId: roleIdByName.get('Employee')! },
    ],
  });
  await prisma.resource.create({
    data: { tenantId, externalId: 'employee-b1', type: 'employee', ownerUserId: 'employee-b1', departmentId: deptEng, sensitivity: ClearanceLevel.CONFIDENTIAL },
  });
  await prisma.policy.create({
    data: {
      tenantId,
      name: 'allow-performance-view',
      effect: PolicyEffect.ALLOW,
      action: 'employee.performance.view',
      resourceType: 'employee',
      conditions: { relationships: ['SELF', 'DIRECT_MANAGER', 'ANCESTOR'], requirePermission: true },
    },
  });

  console.log('  ✓ Tenant B seeded (independent organization)');
}

async function main(): Promise<void> {
  // Safety: never destructively reseed unless explicitly forced. On a fresh DB
  // it seeds; on a DB that already has the demo tenants it skips (so restarting
  // the container never wipes data). Set SEED_RESET=true to force a reseed.
  const forceReset = process.env.SEED_RESET === 'true';
  const existing = await prisma.tenant.findFirst({
    where: { id: { in: ['tenant-a', 'tenant-b'] } },
    select: { id: true },
  });
  if (existing && !forceReset) {
    console.log('▶ Seed skipped: demo tenants already present (set SEED_RESET=true to force).');
    return;
  }

  console.log('▶ Seeding IAM database...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Idempotent reseed: cascade-delete both demo tenants, then recreate.
  await prisma.tenant.deleteMany({ where: { id: { in: ['tenant-a', 'tenant-b'] } } });

  await seedTenantA(passwordHash);
  await seedTenantB(passwordHash);

  console.log(`▶ Done. All users share the password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
