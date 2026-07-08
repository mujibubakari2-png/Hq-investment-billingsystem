Summary of Payment Isolation Hardening

Changes implemented:

- Enforced tenant-scoped behavior in `PaymentService.getChannel()` and `initiatePayment()`.
- Added header normalization and timing-safe HMAC checks in provider implementations.
- Hardened `getPaymentProvider()` with `allowEnvFallback` option to prevent silent platform credential fallback for tenant flows.
- Added DB-level uniqueness constraint `@@unique([provider, tenantId])` to `PaymentChannel` and a partial unique index to ensure a single platform (tenantId=NULL) channel per provider.
- Implemented webhook channel resolution: shared provider webhook routes now enumerate all active channels and verify each one in isolation; the resolved channel's tenantId is trusted for downstream DB actions.
- Added field-level AES-256-GCM encryption for payment secrets; `FIELD_ENCRYPTION_KEY` is required.
- Added CI job `prisma-migrations.yml` to run migration SQL for the partial unique index.

Recommendations / Next steps:

- Deploy the partial-unique-index migration to staging using the CI job or run `npx prisma db execute --file ...`.
- Integrate a KMS (AWS KMS / GCP KMS / HashiCorp Vault) for `FIELD_ENCRYPTION_KEY` and secrets rotation; update `encrypt()`/`decrypt()` to fetch keys via a KMS client.
- Add regression tests that simulate real webhooks for each provider to ensure channel resolution works end-to-end (we added a simple registry test; more integration tests are recommended).
- Frontend: ensure Payment Settings UI enforces tenantId scoping and masks secrets; invalidate caches on update.
- Add monitoring/alerts for `Cross-tenant override denied` and signature verification failures.

Files changed:
- `backend/src/lib/payments/*`
- `backend/src/lib/payments/registry.ts`
- `backend/src/lib/payments/service.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260708_add_platform_unique/migration.sql`
- `backend/prisma/migrations/20260708_add_platform_unique/README.md`
- `.github/workflows/prisma-migrations.yml`

Contact: Ask me to run the full staging deploy when you're ready; I can produce a safe rollout plan and backout steps.
