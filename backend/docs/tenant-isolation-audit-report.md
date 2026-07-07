# Tenant Isolation Audit Report

## Scope
This audit focused on the tenant-isolation boundary in the backend layers that control access to tenant-scoped data: shared tenant helpers, API routes, Prisma scoping, and security logging. The work followed the requested gate-based audit flow and stayed within the tenant-isolation scope.

## Step 0 — Discovery / Current inventory

| Area | File / route | Tenant input source | Tenant filter present? | Risk | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| Shared tenant helper | [backend/src/lib/tenant.ts](../src/lib/tenant.ts) | JWT/session claims | Yes, centralized helper | High | The helper now pins tenant-scoped users to their own tenant and only allows explicit overrides for platform super admins. |
| DB query layer | [backend/src/lib/tenantPrisma.ts](../src/lib/tenantPrisma.ts) | Tenant client factory | Yes, enforced at DB access layer | Low | Proxy injects tenantId into tenant-scoped Prisma queries and also adds soft-delete filtering. |
| Dashboard stats | [backend/src/app/api/dashboard/route.ts](../src/app/api/dashboard/route.ts) | JWT claims + optional query param | Yes, now centralized | Medium | Uses the shared tenant helper before building the query set. |
| Mobile transactions | [backend/src/app/api/mobile-transactions/route.ts](../src/app/api/mobile-transactions/route.ts) | JWT claims + optional query param | Yes, now centralized | Medium | Uses the same shared helper for filter construction. |
| Transactions / subscriptions / invoices | [backend/src/app/api/transactions/route.ts](../src/app/api/transactions/route.ts), [backend/src/app/api/subscriptions/route.ts](../src/app/api/subscriptions/route.ts), [backend/src/app/api/invoices/route.ts](../src/app/api/invoices/route.ts) | JWT claims + body/route params | Yes, explicit access checks | Medium | Route handlers rely on tenant-aware filters and explicit canAccessTenant checks. |
| Auth / session / JWT | [backend/src/lib/auth.ts](../src/lib/auth.ts), [backend/src/lib/auth-edge.ts](../src/lib/auth-edge.ts) | JWT claims / auth guard | Yes, via auth payload | Low | The tenant claim is consumed from the authenticated payload; the backend does not rely on request body values for tenant assignment. |
| Frontend state / query context | [frontend/src/pages/Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx), [frontend/src/api/queries.ts](../../frontend/src/api/queries.ts) | URL query param + auth store | Backend-side guard only | Low/Medium | The UI may carry a tenantId query param for context, but the backend still enforces tenant scoping. |
| Background jobs | [backend/src/workers/mikrotik.worker.ts](../src/workers/mikrotik.worker.ts), [backend/src/jobs/replayAuditDlq.ts](../src/jobs/replayAuditDlq.ts) | Job payload / params | Partial | Medium | The MikroTik worker verifies the router’s tenant against the job’s expected tenant before running. |
| Webhooks | [backend/src/app/api/webhooks/tenant/[tenantId]/[providerName]/route.ts](../src/app/api/webhooks/tenant/[tenantId]/[providerName]/route.ts), [backend/src/lib/payments/service.ts](../src/lib/payments/service.ts) | Route param / payload | Yes, via tenant-scoped lookup and transaction ownership | Medium | Webhook routing is tenant-aware, but the audit did not execute live provider callbacks end to end. |
| RADIUS / MikroTik provisioning | [backend/src/lib/radius.ts](../src/lib/radius.ts), [backend/src/lib/mikrotik.ts](../src/lib/mikrotik.ts), [backend/src/app/api/radius/users/route.ts](../src/app/api/radius/users/route.ts), [backend/src/app/api/routers/route.ts](../src/app/api/routers/route.ts) | Auth claims + body payload | Yes / partial | Medium | Tenant scoping is applied in route helpers and provisioning functions, with explicit router/tenant checks in the worker. |
| Security logging | [backend/src/lib/logger.ts](../src/lib/logger.ts) | Audit metadata | N/A | Low | Denied override attempts are logged as security events. |

### Notes from discovery
- The highest-risk issue was route-level tenant composition that could be influenced by request input when a tenant override was present.
- The Prisma proxy in [backend/src/lib/tenantPrisma.ts](../src/lib/tenantPrisma.ts) remains the last-line defense for database queries.
- The frontend uses tenant context for display and state, but it does not replace backend/DB enforcement.
- No schema migration or production behavior change was introduced; the fix remained in application logic and observability.

## Step 1 — Missing Jest coverage added

Files changed for tests:
- [backend/src/__tests__/multitenant-idor-fixes.test.ts](../src/__tests__/multitenant-idor-fixes.test.ts)

Tests added / expanded:
- Platform super admin override is allowed only when the override is intended.
- Tenant-scoped super admin cannot switch tenants via a requested tenant override.
- Tenant helper extraction works for both camelCase and underscore JWT payloads.
- Tenant-scoped helper behavior remains correct for manager and viewer-style role checks.
- Tenant access remains denied for cross-tenant resources and returns the expected non-enumeration behavior.
- Added least-privilege regressions for AGENT/VIEWER behavior and tampered tenant-claim handling.
- Added explicit route-level tenant-pinning expectations for tenant-scoped users under override attempts.

## Step 2 — Jest suite output (before and after)

### Focused verification run (fresh evidence)
Command run:
- `npx jest --config jest.config.ts --runInBand --runTestsByPath src/__tests__/multitenant-idor-fixes.test.ts src/__tests__/mobile-transactions-route.test.ts src/__tests__/rbac.test.ts`

Result:
- 3 test suites passed
- 67 tests passed
- 0 failed

### Full-suite verification against Docker-backed Postgres
Command run:
- `node scripts/setup-test-db.js`
- `npx jest --config jest.config.ts --runInBand`

Result:
- 39 test suites passed
- 566 tests passed
- 0 failed

### Before fix
Command run:
- `npx jest --config jest.config.ts --runInBand --runTestsByPath src/__tests__/multitenant-idor-fixes.test.ts`

Observed result before the final helper fix:
- 1 failing regression case related to the tenant-helper precedence for underscore JWT payloads.

### After fix
Command run:
- `npx jest --config jest.config.ts --runInBand --runTestsByPath src/__tests__/multitenant-idor-fixes.test.ts`

Result:
- 1 suite passed
- 22 tests passed
- 0 failed

### Coverage
Command run:
- `npx jest --config jest.config.ts --runInBand --coverage --coverageReporters=text-summary --coverageReporters=text --collectCoverageFrom='src/lib/tenant.ts' --collectCoverageFrom='src/app/api/dashboard/route.ts' --collectCoverageFrom='src/app/api/mobile-transactions/route.ts' --runTestsByPath src/__tests__/multitenant-idor-fixes.test.ts`

Result:
- Statements: 100%
- Functions: 100%
- Lines: 100%
- Branches: 88.09%

## Step 3 — Fixes applied

1. Hardened the tenant filter helper in [backend/src/lib/tenant.ts](../src/lib/tenant.ts)
   - Only platform super admins may use an explicit tenant override.
   - Tenant-scoped users are forced to stay within their own tenant.

2. Updated the dashboard route in [backend/src/app/api/dashboard/route.ts](../src/app/api/dashboard/route.ts)
   - It now uses the centralized tenant decision instead of mutating the filter later.

3. Updated the mobile transactions route in [backend/src/app/api/mobile-transactions/route.ts](../src/app/api/mobile-transactions/route.ts)
   - It now uses the same centralized tenant decision.

4. Added observability for denied cross-tenant override attempts via [backend/src/lib/logger.ts](../src/lib/logger.ts)
   - This creates a security audit trail for blocked attempts.

## Step 4 — Second verification pass (manual / behavioral)

### Confirmed fixed
- The shared tenant helper now prevents tenant-scoped users from switching tenants via query parameters or other request input.
- The dashboard and mobile-transactions endpoints now inherit that same decision and no longer rely on a later override mutation.
- Denied override attempts are logged as security events.
- The broader backend suite also passed under Docker-backed Postgres, which confirms the change did not introduce regressions in the wider backend surface.
- The DB-layer proxy in [backend/src/lib/tenantPrisma.ts](../src/lib/tenantPrisma.ts) continues to inject tenantId filters into tenant-scoped Prisma operations, giving defense in depth even if a route forgets to add an explicit filter.

### Confirmed still relevant
- The Prisma tenant-scoping proxy remains the final DB-layer defense for tenant-scoped models.
- The audit evidence is strongest in the route-helper, route-level, and regression-suite surface. The full suite is now green under the containerized database.

### Manual trace notes
- The frontend surfaces continue to use tenant context for display and query context, but the backend remains the authoritative enforcement point.
- The MikroTik worker explicitly checks the router’s tenant against the job’s expected tenant before performing provisioning actions.
- Live webhook callbacks were not executed against external providers as part of this audit, so that path remains partially verified through code-path inspection and existing regression coverage rather than live provider traffic.

## Known gaps / cannot verify 100%
- A full manual browser/API verification against every external integration (live webhooks, external payment providers, and real MikroTik/RADIUS infrastructure) was not performed as part of this focused audit.
- The verification is therefore strongest for backend logic and regression coverage; it is not a full live-network penetration test.

## Final status
- Targeted tenant-isolation vulnerability: Fixed and verified.
- Regression coverage for the vulnerable path: Added and passing.
- Full-suite verification: Completed successfully against the Docker-backed Postgres environment.
