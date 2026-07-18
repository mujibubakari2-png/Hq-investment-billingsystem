Migration: 20260718_add_wireless_fields

This migration adds optional wireless/AP configuration columns to the
`routers` table so the application can persist and manage WLAN SSIDs,
security profiles and chain settings.

How to apply locally:

1. Ensure your `DATABASE_URL` points to a development database.
2. Run the migration SQL directly:

```bash
psql <database-connection-args> -f backend/prisma/migrations/20260718_add_wireless_fields/migration.sql
```

Or run `prisma migrate dev` from the backend to let Prisma generate and
apply migrations. This repository includes a hand-crafted migration file
to make deployments idempotent and safe to run on existing production DBs.
