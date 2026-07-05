import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * FULL-STACK HTTP end-to-end tests.
 *
 * Boots the real AppModule (GraphQL + REST + every global guard/pipe/filter)
 * and drives every feature through the actual HTTP surface — the layer the
 * engine-level e2e tests bypass. Covers: health, metrics, login/refresh/service
 * tokens, all guards (auth, tenant, role, service), the full create→authorize
 * lifecycle, all queries, and pagination.
 */
const T = 'tenant-http';
const ADMIN_EMAIL = 'admin@http.com';
const PLAIN_EMAIL = 'plain@http.com';
const PASSWORD = 'Password123!';

describe('API (full-stack HTTP e2e)', () => {
  let appCtx: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => request.SuperTest<request.Test>;

  let adminToken: string;
  let plainToken: string;

  // ---- GraphQL helper ----
  async function gql(query: string, token?: string): Promise<any> {
    const req = http().post('/graphql').send({ query });
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req;
    return res.body;
  }

  beforeAll(async () => {
    appCtx = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = appCtx.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    http = () => request(app.getHttpServer()) as unknown as request.SuperTest<request.Test>;

    await cleanup();
    await bootstrap();

    adminToken = (await login(ADMIN_EMAIL)).accessToken;
    plainToken = (await login(PLAIN_EMAIL)).accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function cleanup(): Promise<void> {
    await prisma.tenant.deleteMany({ where: { id: T } });
  }

  /** Seed the minimum needed to authenticate an admin and a plain user. */
  async function bootstrap(): Promise<void> {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.tenant.create({ data: { id: T, name: 'HTTP Co', slug: T, status: 'ACTIVE' } });
    await prisma.role.createMany({
      data: [
        { id: `${T}-role-admin`, tenantId: T, name: 'Admin' },
        { id: `${T}-role-emp`, tenantId: T, name: 'Employee' },
      ],
    });
    await prisma.permission.create({
      data: { id: `${T}-perm-all`, tenantId: T, name: '*', resource: '*', action: '*' },
    });
    await prisma.rolePermission.create({
      data: { tenantId: T, roleId: `${T}-role-admin`, permissionId: `${T}-perm-all` },
    });
    await prisma.user.createMany({
      data: [
        { id: `${T}-admin`, tenantId: T, email: ADMIN_EMAIL, passwordHash, clearanceLevel: 'CONFIDENTIAL', employmentStatus: 'ACTIVE' },
        { id: `${T}-plain`, tenantId: T, email: PLAIN_EMAIL, passwordHash, clearanceLevel: 'INTERNAL', employmentStatus: 'ACTIVE' },
      ],
    });
    await prisma.userRole.createMany({
      data: [
        { tenantId: T, userId: `${T}-admin`, roleId: `${T}-role-admin` },
        { tenantId: T, userId: `${T}-plain`, roleId: `${T}-role-emp` },
      ],
    });
  }

  async function login(email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const body = await gql(
      `mutation { login(input:{tenantSlug:"${T}", email:"${email}", password:"${PASSWORD}"}) { accessToken refreshToken } }`,
    );
    return body.data.login;
  }

  // =========================================================================
  // Public endpoints
  // =========================================================================
  describe('Public endpoints', () => {
    it('GET /health → ok', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /metrics → Prometheus text', async () => {
      const res = await http().get('/metrics').expect(200);
      expect(res.text).toContain('iam_authorization_decisions_total');
    });

    it('GraphQL health query works without auth', async () => {
      const body = await gql(`query { health { status service } }`);
      expect(body.data.health.status).toBe('ready');
    });
  });

  // =========================================================================
  // Authentication & tokens
  // =========================================================================
  describe('Auth & tokens', () => {
    it('login returns access + refresh tokens', async () => {
      const body = await gql(
        `mutation { login(input:{tenantSlug:"${T}", email:"${ADMIN_EMAIL}", password:"${PASSWORD}"}) { accessToken refreshToken roles } }`,
      );
      expect(body.data.login.accessToken).toBeTruthy();
      expect(body.data.login.refreshToken).toBeTruthy();
      expect(body.data.login.roles).toContain('Admin');
    });

    it('login with wrong password fails', async () => {
      const body = await gql(
        `mutation { login(input:{tenantSlug:"${T}", email:"${ADMIN_EMAIL}", password:"WRONG"}) { accessToken } }`,
      );
      expect(body.errors?.[0]?.extensions?.code ?? body.errors?.[0]?.code).toBe('UNAUTHORIZED');
    });

    it('refreshToken issues a new access token', async () => {
      const { refreshToken } = await login(ADMIN_EMAIL);
      const body = await gql(`mutation { refreshToken(refreshToken:"${refreshToken}") { accessToken } }`);
      expect(body.data.refreshToken.accessToken).toBeTruthy();
    });

    it('a refresh token cannot authorize a normal request', async () => {
      const { refreshToken } = await login(ADMIN_EMAIL);
      const body = await gql(`query { users { email } }`, refreshToken);
      expect(body.errors?.[0]).toBeTruthy();
      expect(body.data).toBeFalsy();
    });
  });

  // =========================================================================
  // Guards
  // =========================================================================
  describe('Guards', () => {
    it('rejects an unauthenticated request', async () => {
      const body = await gql(`query { users { email } }`);
      expect(body.errors?.[0]?.message).toMatch(/token|api key/i);
    });

    it('tenant guard blocks a mismatched tenantId in the payload', async () => {
      const body = await gql(
        `mutation { checkAccess(input:{tenantId:"some-other-tenant", subjectUserId:"${T}-admin", action:"x", resourceType:"employee", resourceId:"y"}) { allowed } }`,
        adminToken,
      );
      expect(body.errors?.[0]?.message).toMatch(/cross-tenant/i);
    });

    it('role guard blocks createTenant for a non-admin', async () => {
      const body = await gql(
        `mutation { createTenant(input:{name:"Nope", slug:"nope-co"}) { id } }`,
        plainToken,
      );
      expect(body.errors?.[0]?.message).toMatch(/role/i);
    });

    it('role guard allows createTenant for an admin', async () => {
      const slug = `spawned-co`;
      const body = await gql(
        `mutation { createTenant(input:{name:"Spawned", slug:"${slug}"}) { id slug } }`,
        adminToken,
      );
      expect(body.data.createTenant.slug).toBe(slug);
      await prisma.tenant.deleteMany({ where: { slug } }); // clean the spawned tenant
    });

    it('permission guard blocks createPolicy for a user without policy.manage', async () => {
      const body = await gql(
        `mutation { createPolicy(input:{name:"nope", effect:ALLOW, action:"x", resourceType:"y", conditions:{ requirePermission:true }}) { id } }`,
        plainToken,
      );
      expect(body.errors?.[0]?.message).toMatch(/permission/i);
    });
  });

  // =========================================================================
  // Full create → authorize lifecycle through the API
  // =========================================================================
  describe('Create → authorize lifecycle (all mutations + queries)', () => {
    let mgrId: string;
    let empId: string;
    let otherId: string;

    it('createDepartment', async () => {
      const body = await gql(`mutation { createDepartment(input:{name:"Engineering"}) { id name } }`, adminToken);
      expect(body.data.createDepartment.name).toBe('Engineering');
    });

    it('createUser (manager, employee, and an unrelated user)', async () => {
      const mgr = await gql(
        `mutation { createUser(input:{email:"mgr@http.com", clearanceLevel:CONFIDENTIAL}) { id email } }`,
        adminToken,
      );
      mgrId = mgr.data.createUser.id;
      const emp = await gql(
        `mutation { createUser(input:{email:"emp@http.com", managerId:"${mgrId}"}) { id managerId } }`,
        adminToken,
      );
      empId = emp.data.createUser.id;
      expect(emp.data.createUser.managerId).toBe(mgrId);
      const other = await gql(`mutation { createUser(input:{email:"other@http.com"}) { id } }`, adminToken);
      otherId = other.data.createUser.id;
    });

    it('assignManager (re-home the unrelated user, exercising the mutation)', async () => {
      const body = await gql(
        `mutation { assignManager(input:{userId:"${otherId}", managerId:"${mgrId}"}) { id managerId } }`,
        adminToken,
      );
      expect(body.data.assignManager.managerId).toBe(mgrId);
    });

    it('createRole, createPermission, assignPermission, assignRole', async () => {
      const role = await gql(`mutation { createRole(input:{name:"Lead"}) { id name } }`, adminToken);
      const roleId = role.data.createRole.id;
      const perm = await gql(
        `mutation { createPermission(input:{name:"employee.performance.view", resource:"employee", action:"performance.view"}) { id } }`,
        adminToken,
      );
      const permId = perm.data.createPermission.id;
      const ap = await gql(
        `mutation { assignPermission(input:{roleId:"${roleId}", permissionId:"${permId}"}) { id } }`,
        adminToken,
      );
      expect(ap.data.assignPermission.id).toBe(permId);
      const ar = await gql(
        `mutation { assignRole(input:{userId:"${mgrId}", roleId:"${roleId}"}) { id } }`,
        adminToken,
      );
      expect(ar.data.assignRole.id).toBe(roleId);
    });

    it('createPolicy', async () => {
      const body = await gql(
        `mutation { createPolicy(input:{name:"allow-perf", effect:ALLOW, action:"employee.performance.view", resourceType:"employee", conditions:{ relationships:[DIRECT_MANAGER,ANCESTOR], requirePermission:true }}) { id effect } }`,
        adminToken,
      );
      expect(body.data.createPolicy.effect).toBe('ALLOW');
    });

    it('checkAccess ALLOW — manager over direct report (full loop over HTTP)', async () => {
      const body = await gql(
        `mutation { checkAccess(input:{tenantId:"${T}", subjectUserId:"${mgrId}", action:"employee.performance.view", resourceType:"employee", resourceId:"${empId}"}) { allowed reason matchedPolicies decisionId } }`,
        adminToken,
      );
      expect(body.data.checkAccess.allowed).toBe(true);
      expect(body.data.checkAccess.decisionId).toBeTruthy();
    });

    it('checkAccess DENY — unrelated employee (plain user, no permission/relationship)', async () => {
      const body = await gql(
        `mutation { checkAccess(input:{tenantId:"${T}", subjectUserId:"${T}-plain", action:"employee.performance.view", resourceType:"employee", resourceId:"${empId}"}) { allowed } }`,
        adminToken,
      );
      expect(body.data.checkAccess.allowed).toBe(false);
    });

    it('all queries return tenant-scoped data', async () => {
      const q = async (name: string, selection: string) =>
        (await gql(`query { ${name} ${selection} }`, adminToken)).data;

      expect((await q('tenant', '{ id slug }')).tenant.slug).toBe(T);
      expect((await q('users', '{ email }')).users.length).toBeGreaterThan(0);
      expect((await q('departments', '{ name }')).departments.length).toBeGreaterThan(0);
      expect((await q('roles', '{ name }')).roles.length).toBeGreaterThan(0);
      expect((await q('permissions', '{ name }')).permissions.length).toBeGreaterThan(0);
      expect((await q('policies', '{ name }')).policies.length).toBeGreaterThan(0);
      expect(Array.isArray((await q('auditLogs', '{ decision action }')).auditLogs)).toBe(true);
      const hierarchy = await gql(
        `query { organizationHierarchy(userId:"${empId}") { ancestors { userId depth } } }`,
        adminToken,
      );
      expect(hierarchy.data.organizationHierarchy.ancestors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // updateUser (mapped-type DTO) + update→authorization linkage
  // =========================================================================
  describe('updateUser', () => {
    let uid: string;

    it('creates then patches mutable attributes (PartialType/OmitType input)', async () => {
      const created = await gql(
        `mutation { createUser(input:{email:"patch@http.com", clearanceLevel:INTERNAL}) { id clearanceLevel } }`,
        adminToken,
      );
      uid = created.data.createUser.id;
      const patched = await gql(
        `mutation { updateUser(input:{id:"${uid}", clearanceLevel:SECRET, designation:"Staff Eng"}) { clearanceLevel designation } }`,
        adminToken,
      );
      expect(patched.data.updateUser.clearanceLevel).toBe('SECRET');
      expect(patched.data.updateUser.designation).toBe('Staff Eng');
    });

    it('suspending a user via updateUser causes checkAccess to deny them', async () => {
      await gql(`mutation { updateUser(input:{id:"${uid}", employmentStatus:SUSPENDED}) { employmentStatus } }`, adminToken);
      const d = await gql(
        `mutation { checkAccess(input:{tenantId:"${T}", subjectUserId:"${uid}", action:"employee.performance.view", resourceType:"employee", resourceId:"${uid}"}) { allowed reason } }`,
        adminToken,
      );
      expect(d.data.checkAccess.allowed).toBe(false);
      expect(d.data.checkAccess.reason.toLowerCase()).toMatch(/employment|active/);
    });
  });

  // =========================================================================
  // Service-to-service auth
  // =========================================================================
  describe('Service-to-service', () => {
    let apiKey: string;

    it('createServiceIdentity returns an API key (admin only)', async () => {
      const body = await gql(
        `mutation { createServiceIdentity(input:{name:"billing-service"}) { serviceIdentity { id name } apiKey } }`,
        adminToken,
      );
      expect(body.data.createServiceIdentity.apiKey).toContain('.');
      apiKey = body.data.createServiceIdentity.apiKey;
    });

    it('x-api-key authenticates a service checkAccess', async () => {
      const res = await http()
        .post('/graphql')
        .set('x-api-key', apiKey)
        .send({
          query: `mutation { checkAccess(input:{tenantId:"${T}", subjectUserId:"${T}-admin", action:"anything", resourceType:"employee", resourceId:"${T}-admin"}) { allowed } }`,
        });
      // admin is self → SELF relationship; regardless, the request is authenticated
      // (no auth error) and returns a boolean decision.
      expect(res.body.errors).toBeFalsy();
      expect(typeof res.body.data.checkAccess.allowed).toBe('boolean');
    });

    it('issueServiceToken exchanges the key for a service JWT usable as Bearer', async () => {
      const body = await gql(`mutation { issueServiceToken(apiKey:"${apiKey}") { accessToken serviceName } }`);
      expect(body.data.issueServiceToken.serviceName).toBe('billing-service');
      const svcToken = body.data.issueServiceToken.accessToken;
      const decision = await gql(
        `mutation { checkAccess(input:{tenantId:"${T}", subjectUserId:"${T}-admin", action:"x", resourceType:"employee", resourceId:"${T}-admin"}) { allowed } }`,
        svcToken,
      );
      expect(decision.errors).toBeFalsy();
    });

    it('a bad API key is rejected', async () => {
      const res = await http()
        .post('/graphql')
        .set('x-api-key', 'bogus.key')
        .send({ query: `query { users { email } }` });
      expect(res.body.errors?.[0]?.message).toMatch(/invalid service api key/i);
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================
  describe('Validation', () => {
    it('pagination take over the cap is rejected', async () => {
      const body = await gql(`query { users(take: 999) { email } }`, adminToken);
      expect(body.errors?.[0]?.message).toMatch(/take/i);
    });

    it('invalid input is rejected by the ValidationPipe', async () => {
      const body = await gql(`mutation { createTenant(input:{name:"", slug:"BAD SLUG"}) { id } }`, adminToken);
      expect(body.errors?.[0]).toBeTruthy();
    });
  });
});
