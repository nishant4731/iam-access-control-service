# Access Control Across Microservices — System Design

> Design document for an enterprise‑grade, multi‑tenant Access Control (IAM) system for a microservices SaaS platform. The accompanying repository is a **runnable reference implementation** of the core of this design (the authorization engine, closure‑table hierarchy, tenant isolation, and auditing). Where the reference implementation intentionally stops short of full production hardening, this document states the production target and the roadmap.

**Contents**
1. [Functional & Non‑Functional Requirements](#1-functional--non-functional-requirements)
2. [High‑Level Architecture](#2-high-level-architecture)
3. [Authentication & Authorization Flow](#3-authentication--authorization-flow)
4. [Multi‑Tenant Isolation Strategy](#4-multi-tenant-isolation-strategy)
5. [Access Control Model](#5-access-control-model)
6. [Service‑to‑Service Security Approach](#6-service-to-service-security-approach)
7. [APIs & Data Models](#7-apis--data-models)
8. [Scalability & Reliability](#8-scalability--reliability)
9. [Security & Compliance](#9-security--compliance)
10. [Operational Concerns](#10-operational-concerns-monitoring-auditing-debugging)
11. [Production Readiness — Gaps & Roadmap](#11-production-readiness--gaps--roadmap)

---

## 1. Functional & Non‑Functional Requirements

### Functional
- **Centralized authorization decisions** (`checkAccess`) consumed by all platform services (User Mgmt, Expense, Payroll, Invoice, Reporting, Workflow, Notification).
- **Hybrid access control model**: RBAC + ABAC + ReBAC + configurable policy engine.
- **Multi‑tenancy**: each tenant has isolated users, org hierarchy, roles, permissions, policies, and resources.
- **Dynamic role/permission/policy management** at runtime (no redeploy to change access rules).
- **Organization hierarchy** with manager relationships and skip‑level (ancestor) access.
- **Service‑to‑service authorization** (a service acting on behalf of a user).
- **Auditability**: every decision is persisted with a full reasoning trace.
- **Authentication**: end‑user login (JWT) and service authentication (API key / service token).

### Non‑Functional (targets)
| Attribute | Target |
| --- | --- |
| **Authorization latency** | p50 < 5 ms, p99 < 25 ms for a cached decision; p99 < 60 ms cold (DB) |
| **Throughput** | 10k+ `checkAccess` req/s per region (horizontally scalable, stateless) |
| **Scale** | 10k+ tenants, 10M+ users, 100M+ closure rows |
| **Availability** | 99.95% (authorization is on the critical path of every request) |
| **Consistency** | Strong for writes (roles/policies/hierarchy); bounded‑staleness (≤ cache TTL) acceptable for reads |
| **Isolation** | Zero cross‑tenant data leakage — enforced at multiple layers |
| **Auditability** | 100% of decisions logged; tamper‑evident, retained per compliance policy |
| **Security** | Deny‑by‑default; least privilege; no secrets in code |

**Fail mode:** authorization **fails closed** — any error in the pipeline yields DENY, never ALLOW.

---

## 2. High‑Level Architecture

```
        ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
        │  Expense   │   │  Payroll   │   │  Invoice   │   │ Reporting  │ … other services
        └─────┬──────┘   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
              │ checkAccess(subject, action, resource) — over gRPC/GraphQL, authenticated
              └──────────────┬──────────────┬──────────────┘
                             ▼              ▼
                   ┌───────────────────────────────────────┐
                   │        IAM Access Control Service       │  (stateless, N replicas)
                   │  API (GraphQL/gRPC) → Guards → Engine   │
                   │                                         │
                   │  ┌────────────── Engine ─────────────┐  │
                   │  │ RBAC · ABAC · ReBAC · Policy       │  │
                   │  └───────────────────────────────────┘  │
                   └───────┬───────────────┬─────────────────┘
                           │               │
                 ┌─────────▼───┐   ┌───────▼────────┐   ┌──────────────┐
                 │ Decision /  │   │  PostgreSQL    │   │  Audit sink   │
                 │ perm cache  │   │ (primary +     │   │ (append‑only, │
                 │ (Redis)     │   │  read replicas)│   │  stream/WORM) │
                 └─────────────┘   └────────────────┘   └──────────────┘
```

**Component responsibilities**
- **API layer** — GraphQL (implemented) and/or gRPC (recommended for internal service‑to‑service, see §6). Thin resolvers.
- **Guards** — authentication (JWT / service key), tenant isolation, coarse role/permission gates.
- **Authorization engine** — the deterministic decision pipeline (§5).
- **Repositories** — tenant‑scoped data access (Prisma).
- **Cache** — decision + subject‑permission cache (Redis) for scale (§8; not in reference impl).
- **Datastore** — PostgreSQL with read replicas; closure table for hierarchy.
- **Audit sink** — durable, append‑only decision log.

The service is **stateless** → scales horizontally behind a load balancer; all shared state lives in Postgres/Redis.

---

## 3. Authentication & Authorization Flow

Two principals: **end users** and **services**.

### End‑user login (implemented)
```
Client ──login(tenantSlug,email,password)──▶ IAM
  IAM: resolve tenant → verify bcrypt password → load roles+permissions
  IAM: sign JWT { sub, tenantId, roles[], permissions[], isService:false }
Client ◀── accessToken (+ refreshToken)
```
The JWT is the **only trusted source of `tenantId`** downstream. Access token is short‑lived; a refresh token (longer‑lived) mints new access tokens without re‑login.

### Authorization decision (implemented)
```
Caller ──Bearer JWT / x-api-key──▶ IAM.checkAccess(subject, action, resource, tenant)
  JwtAuthGuard      : verify token → AuthContext (tenantId from token)
  TenantGuard       : reject if payload.tenantId ≠ token.tenantId
  AuthorizationSvc  : 1 tenant → 2 subject → 3 resource → 4 RBAC → 5 ABAC
                      → 6 ReBAC (closure) → 7 policy (deny‑override) → 8 audit → 9 decision
Caller ◀── { allowed, effect, reason, matchedPolicies[], decisionId, evaluationTrace[] }
```

### Production auth hardening (design target, §9)
- **Asymmetric JWT (RS256 / EdDSA)** signed by IAM; services verify with the public key via a **JWKS** endpoint — no shared secret distribution.
- **Refresh‑token rotation** with reuse detection; **revocation** list (Redis) for logout/compromise.
- Short access‑token TTL (5–15 min); refresh TTL hours/days.

---

## 4. Multi‑Tenant Isolation Strategy

**Model chosen:** *shared database, shared schema, tenant‑scoped rows* (`tenantId` on every table). Rationale: best fit for 10k+ tenants / 10M+ users (schema‑per‑tenant or DB‑per‑tenant do not scale operationally to those numbers). Trade‑off: isolation must be enforced in software, so we enforce it in **depth**:

1. **Token‑derived tenant** — `tenantId` comes only from the verified JWT/service identity; client‑supplied `tenantId` is never trusted.
2. **Repository scoping** — `BaseTenantRepository` merges `tenantId` into the `where` of every read and the `data` of every create; writes use scoped `updateMany`/`deleteMany`. No repository can issue an unscoped query.
3. **Edge guard** — `TenantGuard` rejects any request whose payload `tenantId` disagrees with the token.
4. **Composite constraints** — all unique keys/indexes are `(tenantId, …)`; foreign keys stay within a tenant.
5. **Resolution boundary** — the engine resolves subjects/resources *within the caller's tenant*; a cross‑tenant id simply "does not exist" → DENY (see acceptance scenario 5).

**Stronger isolation options for high‑compliance tenants (design target):** PostgreSQL **Row‑Level Security (RLS)** policies keyed on a session `app.tenant_id`, and/or `pgbouncer` per‑tenant pools; DB‑per‑tenant for regulated/enterprise tiers. These are additive to the software enforcement above.

---

## 5. Access Control Model

A **hybrid** model. Each dimension answers a different question; the policy engine combines them.

### RBAC — *what can this role do?*
Users → roles → permissions (`resource.action`, e.g. `employee.performance.view`). Supports `*` and `resource.*` wildcards. Coarse gating via `@Roles`/`@RequirePermission` guards; fine‑grained checks in the engine.

### ABAC — *do the attributes line up?*
Evaluates subject/resource attributes: department, location, employment status, and the **clearance ↔ sensitivity** lattice (`PUBLIC < INTERNAL < CONFIDENTIAL < SECRET < TOP_SECRET`). A subject may access a resource only if `clearance ≥ sensitivity` and sensitivity ≤ the policy's ceiling.

### ReBAC — *what is the relationship?*
The subject's relationship to the **resource owner** in the org hierarchy: `SELF | DIRECT_MANAGER | ANCESTOR | SIBLING | NONE`. Resolved from the **closure table** in a single indexed lookup (never a recursive manager walk):

```
OrganizationHierarchyClosure(tenantId, ancestorUserId, descendantUserId, depth)
  isDirectManager(A,B) → row (A,B,depth=1)
  isAncestor(A,B)      → row (A,B,depth≥1)
  siblings(A,B)        → share the same depth‑1 ancestor
```
Maintenance on `assignManager` is a cross‑join insert with cycle prevention and safe re‑parenting. Reads are O(1) indexed; the cost moves to (infrequent) writes — the correct trade‑off for a read‑heavy authorization workload.

### Policy engine — *the combining algorithm*
Policies are **data** in PostgreSQL (typed JSON conditions), not code. Combining is **deny‑override** (AWS IAM / Azure RBAC semantics):

```
1. Deny by default.
2. Any matching explicit DENY  → DENY (wins over everything).
3. Otherwise a matching ALLOW  → ALLOW.
```
A policy *matches* only when its ReBAC (relationship), ABAC (attributes), and RBAC (`requirePermission`) clauses all pass. This makes the model **extensible**: new signals become new evaluators/clauses without touching the engine.

Full pipeline and diagram: see [`README.md`](./README.md#authorization-model--flow).

---

## 6. Service‑to‑Service Security Approach

Services never make their own authorization decisions — they **delegate** to IAM. Two concerns: (a) authenticating the *service*, and (b) conveying the *end‑user* on whose behalf it acts.

### Authenticating the service (implemented)
Each calling service has a **`ServiceIdentity`** (per tenant in the reference impl) with an **API key** (`<serviceIdentityId>.<secret>`, stored only as a bcrypt hash). Two implemented flows:

- **Direct API key** — the service sends `x-api-key`; the guard validates it per request.
- **Service JWT** (preferred) — the service calls `issueServiceToken(apiKey)` once to exchange the key for a short‑lived **service JWT** (`isService: true`), then sends `Authorization: Bearer <serviceToken>`. This avoids putting the long‑lived key on every request — the analogue of AWS STS temporary credentials.

Either way the guard builds a service `AuthContext` (`isService: true`). Service principals are trusted infrastructure and carry a `*` permission for their tenant, so they can ask `checkAccess` for any subject/resource in that tenant.

```
Expense Service ──x-api-key──▶ IAM.checkAccess(
    subjectUserId: <the end user>, action:"expense.approve", resource:"expense-42")
```

### Conveying the end user (design pattern)
Two accepted patterns:
- **Token forwarding** — the gateway/service forwards the end user's original JWT; IAM decides for that user. Zero trust in the relaying service. *Preferred.*
- **On‑behalf‑of** — the authenticated service passes `subjectUserId`; IAM trusts the service to relay the correct subject. Simpler; used by the reference impl.

### Production target
- **mTLS** between services (SPIFFE/SPIRE workload identities) *plus* short‑lived service JWTs (RS256) — mutual authentication + authorization.
- **Asymmetric signing + JWKS** so services verify user tokens offline (no shared secret).
- **Scoped service credentials** (which tenants / which actions a service may query), rotated automatically.
- **Global (cross‑tenant) services**: in production the Expense service serves all tenants, so a service identity should be *platform‑level* with an allow‑list of tenants, rather than one identity per tenant. (The reference impl keeps it per‑tenant to match the data model and stay runnable.)

---

## 7. APIs & Data Models

### API surface (GraphQL code‑first; implemented)
- **Queries:** `health`, `tenant`, `user(s)`, `department(s)`, `role(s)`, `permissions`, `policies`, `auditLogs`, `organizationHierarchy`.
- **Mutations:** `login`, `refreshToken`, `createTenant`, `createDepartment`, `createUser`, `assignManager`, `createRole`, `createPermission`, `assignRole`, `assignPermission`, `createPolicy`, `createServiceIdentity`, **`checkAccess`**.

For internal, high‑throughput callers, a **gRPC** `Authorize` RPC is recommended (lower overhead than GraphQL, first‑class deadlines/streaming). GraphQL remains the admin/management API.

### Data model
Entities: `Tenant`, `Department` (self‑referential), `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Policy` (typed JSON conditions), `Resource`, `OrganizationHierarchyClosure`, `ServiceIdentity`, `AccessAuditLog`. Full ER diagram and constraints: [`README.md`](./README.md#data-model--er-diagram) and [`prisma/schema.prisma`](./prisma/schema.prisma).

---

## 8. Scalability & Reliability

Target: **10M+ users, high throughput**. The design keeps the decision path cheap and the service stateless.

### Read path (the hot path)
- **Statelessness** → horizontal scale behind an LB; no sticky sessions.
- **Permission & policy caches (implemented)** — the two DB‑heavy reads on the hot path are cached: flattened `permissionNames` per user, and applicable policies per `(tenant, action, resourceType)`. Backed by an in‑memory L1 store behind a storage‑agnostic `CacheService`; **invalidated on writes** (`assignRole` → that user; `assignPermission` → tenant's permission cache; `createPolicy` → tenant's policy cache). Cache hit/miss is exported to Prometheus. In production this L1 gains a shared **Redis L2** across replicas.
- **Decision cache (target)** — additionally cache `(tenant, subject, action, resource) → decision` with a short TTL for the p50 < 5 ms target; kept out of the reference impl to preserve per‑call audit completeness (a hit would otherwise skip the audit write — a deliberate trade‑off to document).
- **Closure table** — makes ReBAC an O(1) indexed lookup instead of a recursive CTE. Composite indexes on `(tenantId, ancestorUserId, depth)` and `(tenantId, descendantUserId)`.
- **Read replicas** — route `checkAccess` reads to replicas; bounded staleness is acceptable and mitigated by cache TTL.
- **Avoiding N+1** — batch subject facts in one query; DataLoader for any nested GraphQL resolution.

### Cache invalidation
Emit domain events on writes (`RoleAssigned`, `PolicyChanged`, `ManagerAssigned`) → invalidate the affected cache keys (by tenant, by subject, or flush the tenant's decision namespace for hierarchy/policy changes). This keeps correctness while serving from cache.

### Write path
- **Closure table write amplification**: re‑parenting a subtree of size *m* under an ancestor chain of length *k* is O(m·k) row changes, done transactionally. Rare relative to reads; for very large orgs, do it as a background job.
- **Partitioning**: `access_audit_logs` and `organization_hierarchy_closure` partition naturally **by tenant** (and audit by time) for large tenants.

### Reliability
- **Fail closed** — errors → DENY.
- **Migrations as a job** — run `migrate deploy` as an init‑container/Job, not inside every app replica, to avoid concurrent‑migration races (the reference impl runs it in the entrypoint for single‑node simplicity).
- **Healthchecks** — liveness (`/health`) + readiness (DB ping); LB removes unhealthy replicas.
- **Graceful shutdown** — Nest shutdown hooks drain in‑flight requests and close the DB pool.
- **Backpressure** — connection‑pool limits + request timeouts; circuit‑breaking on the DB.
- **Multi‑AZ** Postgres with automated failover; PITR backups.

---

## 9. Security & Compliance

### AuthN / AuthZ
- Deny‑by‑default, least privilege, defense‑in‑depth tenant isolation (§4).
- **JWT**: reference impl uses HS256; **production target is RS256/EdDSA + JWKS** (no shared secrets), short access‑token TTL, refresh‑token rotation with reuse detection, and a **revocation** list for logout/compromise.
- **Rate limiting / brute‑force protection** on `login` (per‑IP + per‑account), with lockout/backoff. *(Design target.)*
- Passwords hashed with **bcrypt**; enforce a password policy; never returned by the API (`passwordHash` is dropped in the mapper).

### Data protection
- **Secrets** only via environment / secret manager (Vault, AWS Secrets Manager); nothing hardcoded; `.env` is git‑ignored.
- **Encryption**: TLS in transit; **encryption at rest** (KMS‑managed) for the DB and audit sink.
- **PII minimization** — the IAM stores only what it needs (email, org attributes); sensitive attributes carry clearance levels.
- **Input validation** — global `ValidationPipe` (whitelist + transform) on every DTO; errors sanitized by the global exception filter (no internal leakage).

### Compliance / auditability
- **Immutable audit trail** — every decision persisted with `decisionId`, subject, action, resource, effect, matched policies, full evaluation trace, correlation id, latency. Suitable for SOC 2 / ISO 27001 evidence and forensic replay.
- **Tamper‑evidence (target)** — ship audit to append‑only/WORM storage or hash‑chain records.
- **Retention** — configurable retention + archival to satisfy GDPR/industry rules; "right to be forgotten" handled via tenant/user deletion cascades.
- **Threat model highlights**: cross‑tenant access (mitigated §4), privilege escalation via forged tokens (asymmetric signing), policy misconfiguration (dry‑run/simulate before publish), replay (short TTL + revocation).

---

## 10. Operational Concerns (monitoring, auditing, debugging)

- **Structured logging** — Pino JSON logs with `correlationId`/`requestId` on every line; auth headers redacted. Correlation id is accepted from upstream for cross‑service tracing.
- **Metrics (implemented)** — Prometheus `/metrics`: `iam_authorization_decisions_total{tenant,effect}`, `iam_authorization_decision_duration_ms` histogram, `iam_cache_operations_total{cache,result}` (hit ratio), plus Node defaults. The `LoggingInterceptor` also records per‑resolver latency.
- **Distributed tracing (implemented, export opt‑in)** — the engine wraps each decision in an OpenTelemetry span (`authorization.checkAccess`) via `@opentelemetry/api`. Spans are no‑ops until a provider is registered; set `OTEL_ENABLED=true` (and install the SDK) to export to an OTLP collector across gateway → service → IAM → DB, keyed by correlation id.
- **Auditing** — the `AccessAuditLog` is both a compliance artifact and a debugging tool: every decision is reproducible from its `decisionId` + `evaluationTrace` (you can see exactly which RBAC/ABAC/ReBAC/policy step drove the result).
- **Alerting (target)** — on deny‑rate spikes (possible attack or misconfig), latency SLO breaches, replica lag, error rates.
- **Debuggability** — `checkAccess` returns the full `evaluationTrace`; support/engineers can replay a user's decision without reproducing their session.
- **Runbooks (target)** — token key rotation, cache flush, replica failover, policy rollback.

---

## 11. Production Readiness — Gaps & Roadmap

The reference implementation deliberately implements the **hard, differentiating core** (hybrid engine, closure table, tenant isolation, audit, service‑to‑service auth) to production quality, and **stubs or documents** the operational scaffolding. Honest status:

| Capability | Reference impl | Production target |
| --- | --- | --- |
| Authorization engine (RBAC/ABAC/ReBAC/policy, deny‑override) | ✅ Implemented & tested | ✅ |
| Closure‑table hierarchy | ✅ Implemented & tested | ✅ |
| Tenant isolation (3 layers) | ✅ Implemented & tested | ✅ + optional RLS / DB‑per‑tenant tiers |
| Audit trail | ✅ Implemented | ✅ + WORM/hash‑chain + retention |
| Service‑to‑service auth | ✅ API‑key **and** service‑JWT flows | + mTLS (SPIFFE/SPIRE) + RS256/JWKS |
| JWT | ✅ HS256 + access/refresh tokens | RS256/EdDSA + JWKS + rotation + revocation |
| Pagination on list APIs | ✅ Added (take/skip, capped) | ✅ + cursor pagination |
| Permission / policy caching | ✅ In‑memory cache + write invalidation | Redis (L2, shared across replicas) |
| Metrics | ✅ Prometheus `/metrics` (decisions, latency, cache hit/miss) | + dashboards & alerts |
| Tracing | ✅ OTel spans in engine (export opt‑in: `OTEL_ENABLED`) | Always‑on collector + auto‑instrumentation |
| Rate limiting / lockout | ❌ (documented) | Per‑IP/account throttling |
| Migrations at scale | ⚠️ entrypoint | Init‑container/Job |
| Destructive seed safety | ✅ Env‑gated (non‑destructive by default) | N/A (seed is a dev tool) |

**Recommended build order to production:** decision/permission cache → RS256/JWKS + refresh rotation/revocation → rate limiting → Prometheus/OTel → gRPC `Authorize` RPC + batch endpoint → RLS for high‑compliance tenants.
