#!/usr/bin/env sh
set -eu

timeout="${WAIT_FOR_DB_TIMEOUT:-60}"
skip_validation="${SKIP_SCHEMA_VALIDATION:-false}"

log() {
  printf '%s\n' "[startup-init-db] $*"
}

fail() {
  printf '%s\n' "[startup-init-db] ERROR: $*" >&2
  exit 1
}

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL environment variable is not set"
fi

wait_for_postgres() {
  elapsed=0
  log "Waiting for PostgreSQL for up to ${timeout}s"

  while [ "$elapsed" -lt "$timeout" ]; do
    if pg_isready -d "$DATABASE_URL" --timeout=5 >/dev/null 2>&1; then
      log "PostgreSQL is available"
      return 0
    fi

    elapsed=$((elapsed + 5))
    sleep 5
  done

  fail "PostgreSQL did not become available within ${timeout}s"
}

validate_schema() {
  if [ "$skip_validation" = "true" ]; then
    log "Schema validation skipped"
    return 0
  fi

  for table in users tenants clients packages subscriptions invoices transactions radacct; do
    exists="$(psql "$DATABASE_URL" -Atc "select 1 from information_schema.tables where table_schema='public' and table_name='${table}'" 2>/dev/null || true)"
    if [ "$exists" != "1" ]; then
      fail "Critical table missing: ${table}"
    fi
  done

  for table in clients subscriptions invoices transactions radacct; do
    exists="$(psql "$DATABASE_URL" -Atc "select 1 from information_schema.columns where table_schema='public' and table_name='${table}' and column_name='tenantId'" 2>/dev/null || true)"
    if [ "$exists" != "1" ]; then
      fail "Tenant isolation column missing: ${table}.tenantId"
    fi
  done

  log "Schema and tenant isolation checks passed"
}

wait_for_postgres

log "Applying Prisma migrations"
npx prisma migrate deploy --schema=prisma/schema.prisma

log "Generating Prisma client"
npx prisma generate --schema=prisma/schema.prisma

validate_schema

if [ -f "scripts/seed.ts" ]; then
  log "Ensuring default seed data"
  npx tsx scripts/seed.ts || log "Seed script failed; continuing because migrations and schema validation passed"
fi

log "Database initialization complete"
