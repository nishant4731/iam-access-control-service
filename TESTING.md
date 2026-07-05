# Testing

**76 automated tests across 8 suites, all green.** Unit tests are pure (no DB); e2e tests run against the Dockerized Postgres and boot the real Nest app.

## How to run

```bash
# One command — starts Postgres, applies migrations, runs the FULL suite:
npm run test:e2e

# Fast, no database (evaluator + cache units only):
npm run test:unit

# Coverage report:
npm run test:cov            # requires Postgres up (see below)
```

`test:e2e` uses [`scripts/test-e2e.sh`](scripts/test-e2e.sh): `docker compose up -d postgres` → wait for readiness → `prisma migrate deploy` → `jest`. `DATABASE_URL` is read from `.env` automatically (Postgres is published on host port **5433**).

To narrow: `npm run test:e2e -- test/api.e2e.spec.ts`.

---

## What each suite proves

### Unit — pure logic, no DB (`src/**/*.spec.ts`)

| Suite | Proves |
| --- | --- |
| `authorization/evaluators/rbac.evaluator.spec.ts` | RBAC grants on exact permission, denies without it, honors `*` and `resource.*` wildcards |
| `authorization/evaluators/abac.evaluator.spec.ts` | ABAC clauses: department / location / employment-status membership; clearance ≥ sensitivity; resource ≤ policy ceiling; empty condition matches |
| `authorization/evaluators/rebac.evaluator.spec.ts` | Relationship resolution delegates to the closure table; `satisfies()` matches only the allowed relationship set; no-owner → NONE |
| `authorization/evaluators/policy.evaluator.spec.ts` | The combining algorithm: deny-by-default, ALLOW requires the RBAC clause, **explicit DENY overrides ALLOW** |
| `common/cache/cache.service.spec.ts` | Cache set/get, TTL expiry, prefix invalidation, get-or-load (`wrap`) loads exactly once |

### e2e — real database + real engine/app (`test/*.e2e.spec.ts`)

| Suite | Proves |
| --- | --- |
| `authorization.e2e.spec.ts` | **The 8 acceptance scenarios**; closure-table relationships (SELF/DIRECT_MANAGER/ANCESTOR/SIBLING/NONE); tenant isolation (cross-tenant → DENY); an audit row is written per decision |
| `hardening.e2e.spec.ts` | **Live cache invalidation** (assignRole / assignPermission flip a later decision DENY→ALLOW without waiting for TTL); closure **re-parenting** stays consistent; **cycle prevention**; ABAC clearance denial through the full engine; suspended subject denied; inactive tenant denied |
| `api.e2e.spec.ts` | **Full HTTP stack** through GraphQL/REST + every global guard: health, `/metrics`, login/refresh/service-token, **all 4 guards** (auth, tenant, role, permission), the complete create→authorize lifecycle, `updateUser`→suspend→deny, every query, service-to-service (x-api-key + service JWT), and input/pagination validation |

---

## Coverage of the requirement matrix

| Requirement area | Covered by |
| --- | --- |
| RBAC / ABAC / ReBAC / policy engine | evaluator units + `authorization.e2e` |
| `checkAccess` decision + audit + decisionId | `authorization.e2e`, `api.e2e` |
| Closure table (build, query, re-parent, cycle) | `authorization.e2e`, `hardening.e2e` |
| Tenant isolation (repo + engine + edge guard) | `authorization.e2e`, `api.e2e` (tenant guard) |
| AuthN: login / refresh / service JWT / API key | `api.e2e` |
| Guards: JWT, tenant, role, permission | `api.e2e` |
| Caching + invalidation | `cache.service` unit + `hardening.e2e` (live) |
| All GraphQL mutations & queries | `api.e2e` |
| Observability: `/health`, `/metrics` | `api.e2e` |
| Input validation & pagination caps | `api.e2e` |

---

## Manual / non-functional checks

- **Load smoke:** 5,000 `checkAccess` @ concurrency 100 → **~1,308 req/s, 0 errors, p50 71 ms / p99 157 ms**, and **~99.6% cache hit ratio** (permissions & policies). Script: `scripts/` (or re-run against a started server).
- **Docker:** `docker compose up --build` → healthy container, migrations applied, seed loaded, live `checkAccess` verified.

## Intentionally out of scope (documented roadmap, not gaps)

See [`DESIGN.md` §11](DESIGN.md#11-production-readiness--gaps--roadmap). Not covered by tests because not implemented (by design for a take-home): RS256/JWKS, refresh-token rotation/revocation, rate limiting, Redis L2 / decision-level cache, always-on OTel export, and a sustained load benchmark.
