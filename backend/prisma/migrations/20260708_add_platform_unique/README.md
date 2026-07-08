This migration adds a partial unique index to ensure there is only one PLATFORM-scoped PaymentChannel per provider.

Why:
- Application-layer uniqueness (`@@unique([provider, tenantId])`) does not prevent multiple rows where `tenantId IS NULL` because Postgres treats NULLs as distinct in unique constraints.

What it does:
- Creates `uniq_payment_channel_provider_platform` index on `payment_channels(provider)` WHERE `tenant_id IS NULL`.

How to apply:
- The project's CI/deploy pipeline should run Prisma migrations or execute this SQL prior to starting the service.
- Locally you can run (from `backend`):

```powershell
$env:DATABASE_URL='postgresql://<user>:<pass>@<host>:<port>/<db>'
npx prisma db execute --file prisma/migrations/20260708_add_platform_unique/migration.sql
```

Rollback:
- To drop the index if needed:

```sql
DROP INDEX IF EXISTS uniq_payment_channel_provider_platform;
```
