This migration directory was created to preserve the missing-schema patch in a form that
Prisma migrate can apply automatically.

The SQL here is a copy of the legacy reference file:
backend/prisma/migrations/20260613_complete_schema_and_missing_tables.sql

If you need to re-create this migration from scratch, use:
  pnpm --filter backend exec prisma migrate diff --from-schema-datamodel ./prisma/schema.prisma --to-schema-datamodel ./prisma/schema.prisma

Note: The legacy .sql file is kept for audit/history, but Prisma migrate will only use the
migration directory name above.
