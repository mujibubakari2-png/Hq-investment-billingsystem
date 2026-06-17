#!/bin/bash
# =============================================================================
# Database Startup Initialization Script — HQ Investment ISP Platform
# DO-006 FIX: Automated database initialization and verification on startup
#
# Purpose: Execute on every startup to ensure database is ready for the app:
#   1. Wait for PostgreSQL to be available
#   2. Apply all pending Prisma migrations
#   3. Verify schema completeness
#   4. Check multi-tenant isolation integrity
#   5. Validate critical tables and constraints
#   6. Initialize default system data (SaaS plans, roles)
#
# Usage:
#   Called automatically by Docker: see Dockerfile CMD
#   Can also be run manually: bash scripts/startup-init-db.sh
#
# Exit codes:
#   0 = Success (database ready)
#   1 = Failure (database not ready, app should not start)
#
# Environment variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#   WAIT_FOR_DB_TIMEOUT - Seconds to wait for DB (default: 60)
#   SKIP_SCHEMA_VALIDATION - Skip validation checks (default: false)
#
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
TIMEOUT="${WAIT_FOR_DB_TIMEOUT:-60}"
SKIP_VALIDATION="${SKIP_SCHEMA_VALIDATION:-false}"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Logging functions ─────────────────────────────────────────────────────────
log() { echo -e "${GREEN}[${TIMESTAMP}]${NC} $*"; }
error() { echo -e "${RED}[${TIMESTAMP}] ERROR:${NC} $*" >&2; exit 1; }
warn() { echo -e "${YELLOW}[${TIMESTAMP}] WARNING:${NC} $*"; }
info() { echo -e "${BLUE}[${TIMESTAMP}] INFO:${NC} $*"; }

# ── Step 1: Verify DATABASE_URL ────────────────────────────────────────────────
log "Starting database initialization sequence..."

if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL environment variable is not set"
fi

info "Database URL: ${DATABASE_URL//:[^:]*@/:****@}"

# ── Step 2: Wait for PostgreSQL to become available ──────────────────────────
wait_for_postgres() {
  log "Waiting for PostgreSQL to become available (timeout: ${TIMEOUT}s)..."

  ELAPSED=0
  while [ $ELAPSED -lt "$TIMEOUT" ]; do
    if pg_isready -d "$DATABASE_URL" --timeout=5 &>/dev/null; then
      log "✓ PostgreSQL is available"
      return 0
    fi

    ELAPSED=$((ELAPSED + 5))
    warn "PostgreSQL not ready yet ($ELAPSED/${TIMEOUT}s)... waiting"
    sleep 5
  done

  error "PostgreSQL did not become available within ${TIMEOUT} seconds"
}

# ── Step 3: Apply Prisma migrations ───────────────────────────────────────────
apply_migrations() {
  log "Applying Prisma migrations..."

  if ! npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1; then
    error "Prisma migration deployment failed"
  fi

  log "✓ All pending migrations applied successfully"
}

# ── Step 4: Generate Prisma client ────────────────────────────────────────────
generate_prisma() {
  log "Generating Prisma client..."

  if ! npx prisma generate --schema=prisma/schema.prisma 2>&1; then
    error "Prisma code generation failed"
  fi

  log "✓ Prisma client generated"
}

# ── Step 5: Validate schema completeness ──────────────────────────────────────
validate_schema() {
  if [ "$SKIP_VALIDATION" = "true" ]; then
    warn "Schema validation skipped (SKIP_SCHEMA_VALIDATION=true)"
    return 0
  fi

  log "Validating database schema completeness..."

  # Check for critical tables
  local CRITICAL_TABLES=("users" "tenants" "clients" "packages" "subscriptions" "invoices" "radacct")

  for table in "${CRITICAL_TABLES[@]}"; do
    if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" 2>/dev/null | grep -q 1; then
      error "Critical table missing: $table"
    fi
  done

  log "✓ All critical tables present"

  # Check for multi-tenant isolation (tenantId on core tables)
  local MULTI_TENANT_TABLES=("clients" "subscriptions" "invoices" "transactions" "radacct")
  local MISSING_TENANT_ID=false

  for table in "${MULTI_TENANT_TABLES[@]}"; do
    if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.columns WHERE table_name='$table' AND column_name='tenantId';" 2>/dev/null | grep -q 1; then
      warn "Table $table missing tenantId column (multi-tenant isolation at risk)"
      MISSING_TENANT_ID=true
    fi
  done

  if [ "$MISSING_TENANT_ID" = "true" ]; then
    error "Multi-tenant isolation not properly configured"
  fi

  log "✓ Multi-tenant isolation verified (all core tables have tenantId)"

  # Check for foreign key constraints
  local FK_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public';" 2>/dev/null | tr -d ' ')

  if [ "$FK_COUNT" -lt 30 ]; then
    warn "Only $FK_COUNT foreign keys found (expected 40+). Schema may be incomplete."
  else
    log "✓ Foreign key constraints verified ($FK_COUNT total)"
  fi
}

# ── Step 6: Initialize default system data ────────────────────────────────────
initialize_system_data() {
  log "Checking for default system data..."

  # Check if SaaS plans exist
  local PLAN_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM saas_plans;" 2>/dev/null | tr -d ' ')

  if [ "$PLAN_COUNT" -eq 0 ]; then
    log "Initializing default SaaS plans..."

    if [ -f "scripts/seed.ts" ]; then
      if ! npx tsx scripts/seed.ts 2>&1; then
        warn "Seed script failed (non-critical, can be run manually later)"
      else
        log "✓ Default data seeded successfully"
      fi
    else
      warn "Seed script not found (scripts/seed.ts). Skipping initialization."
    fi
  else
    log "✓ System data already initialized ($PLAN_COUNT SaaS plans found)"
  fi
}

# ── Step 7: Health check ──────────────────────────────────────────────────────
health_check() {
  log "Running database health checks..."

  # Test connection
  if ! psql "$DATABASE_URL" -t -c "SELECT NOW();" &>/dev/null; then
    error "Database health check failed (cannot query current timestamp)"
  fi

  log "✓ Database is healthy and responding"
}

# ── Main execution ────────────────────────────────────────────────────────────

log "═══════════════════════════════════════════════════════════════"
log "DATABASE STARTUP INITIALIZATION"
log "═══════════════════════════════════════════════════════════════"

wait_for_postgres
apply_migrations
generate_prisma
validate_schema
initialize_system_data
health_check

log "═══════════════════════════════════════════════════════════════"
log "✓ DATABASE INITIALIZATION COMPLETED SUCCESSFULLY"
log "═══════════════════════════════════════════════════════════════"
log "The application is now ready to start."

exit 0
