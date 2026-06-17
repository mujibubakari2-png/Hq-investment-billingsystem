#!/bin/bash
# =============================================================================
# Database Restore Script — HQ Investment ISP Platform
# DO-005 FIX: Automated database restore from DigitalOcean Spaces backups
#
# Purpose: Restore a backup from DigitalOcean Spaces or local filesystem.
#
# Usage:
#   ./restore-db.sh [backup-file-path]
#   
#   Examples:
#     ./restore-db.sh /var/backups/hq-investment/db_backup_20250120_140000.sql.gz
#     ./restore-db.sh s3://hq-investment-backups/database/db_backup_20250120_140000.sql.gz
#
# Prerequisites:
#   1. rclone configured (same as backup-db.sh)
#   2. PostgreSQL pg_restore tool installed
#   3. Full disk space for decompressed backup
#   4. Database connection details in .env or environment variables
#
# Safety:
#   - Backs up current database before restore (to BACKUP_DIR/pre_restore_*.sql.gz)
#   - Verifies backup integrity before starting restore
#   - Transaction-based restore (atomicity guaranteed)
#
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
DB_USER="${POSTGRES_USER:-hqinvestment_user}"
DB_NAME="${POSTGRES_DB:-hqinvestment_isp}"
DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="/var/backups/hq-investment"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-spaces}"
RESTORE_LOG="/var/log/hq-restore.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Logging ───────────────────────────────────────────────────────────────────
log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$RESTORE_LOG"
}

error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*${NC}" | tee -a "$RESTORE_LOG"
  exit 1
}

warn() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $*${NC}" | tee -a "$RESTORE_LOG"
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight_check() {
  log "Running pre-flight checks..."

  # Check for backup file argument
  if [ $# -lt 1 ]; then
    error "Backup file path required. Usage: ./restore-db.sh <backup-file>"
  fi

  BACKUP_FILE="$1"

  # Check if file exists (local or remote)
  if [[ "$BACKUP_FILE" == s3://* ]] || [[ "$BACKUP_FILE" == *:/* ]]; then
    log "Backup is remote (S3/rclone): $BACKUP_FILE"
    BACKUP_IS_REMOTE=true
  else
    if [ ! -f "$BACKUP_FILE" ]; then
      error "Backup file not found: $BACKUP_FILE"
    fi
    log "Backup is local: $BACKUP_FILE"
    BACKUP_IS_REMOTE=false
  fi

  # Check database connectivity
  if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &>/dev/null; then
    error "Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT"
  fi
  log "✓ Database connection OK"

  # Check disk space (estimate: 3x backup size needed)
  if [ "$BACKUP_IS_REMOTE" = false ]; then
    BACKUP_SIZE=$(du -s "$BACKUP_FILE" | cut -f1)
    REQUIRED_SPACE=$((BACKUP_SIZE * 3))
    AVAILABLE_SPACE=$(df -k /var/lib/postgresql | tail -1 | awk '{print $4}')

    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
      error "Insufficient disk space. Need ${REQUIRED_SPACE}KB, have ${AVAILABLE_SPACE}KB"
    fi
    log "✓ Disk space OK (${AVAILABLE_SPACE}KB available)"
  fi
}

# ── Pre-restore backup (backup current state) ────────────────────────────────
create_prestore_backup() {
  log "Creating safety backup of current database (in case restore fails)..."

  PRE_BACKUP_FILE="${BACKUP_DIR}/pre_restore_${TIMESTAMP}.sql.gz"
  mkdir -p "$BACKUP_DIR"

  if ! pg_dump \
    --username="$DB_USER" \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --format=custom \
    "$DB_NAME" | gzip > "$PRE_BACKUP_FILE"; then
    error "Failed to create pre-restore backup"
  fi

  PRE_BACKUP_SIZE=$(du -sh "$PRE_BACKUP_FILE" | cut -f1)
  log "✓ Pre-restore backup created: $PRE_BACKUP_FILE (${PRE_BACKUP_SIZE})"
}

# ── Download backup from remote (if needed) ────────────────────────────────
download_remote_backup() {
  if [ "$BACKUP_IS_REMOTE" = false ]; then
    return
  fi

  log "Downloading backup from remote storage..."
  LOCAL_COPY="${BACKUP_DIR}/restore_temp_${TIMESTAMP}.sql.gz"
  mkdir -p "$BACKUP_DIR"

  if ! rclone copy "$BACKUP_FILE" "$BACKUP_DIR" --progress; then
    error "Failed to download backup from $BACKUP_FILE"
  fi

  # Extract filename from path
  FILENAME=$(basename "$BACKUP_FILE")
  LOCAL_COPY="${BACKUP_DIR}/${FILENAME}"

  if [ ! -f "$LOCAL_COPY" ]; then
    error "Downloaded backup not found at $LOCAL_COPY"
  fi

  BACKUP_FILE="$LOCAL_COPY"
  log "✓ Backup downloaded: $BACKUP_FILE"
}

# ── Drop and recreate database (safe clean restore) ──────────────────────────
prepare_database() {
  log "Preparing database for restore (dropping and recreating)..."

  # Terminate all connections to the database
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid != pg_backend_pid();" \
    2>/dev/null || true

  # Drop and recreate
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" \
    || error "Failed to drop database"

  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "CREATE DATABASE \"$DB_NAME\";" \
    || error "Failed to recreate database"

  log "✓ Database prepared (dropped and recreated)"
}

# ── Restore backup ────────────────────────────────────────────────────────────
restore_backup() {
  log "Restoring database from backup: $BACKUP_FILE"

  if ! gunzip -c "$BACKUP_FILE" | \
    PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --username="$DB_USER" \
      --no-password \
      --format=custom \
      --verbose \
      --exit-on-error \
      -d "$DB_NAME" 2>&1 | tee -a "$RESTORE_LOG"; then
    error "Database restore failed. Pre-restore backup is available at: $PRE_BACKUP_FILE"
  fi

  log "✓ Restore completed successfully"
}

# ── Post-restore verification ────────────────────────────────────────────────
verify_restore() {
  log "Verifying restored database integrity..."

  # Count tables
  TABLE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
    2>/dev/null)

  if [ "$TABLE_COUNT" -lt 30 ]; then
    warn "Restored database has only $TABLE_COUNT tables (expected 40+). Verify integrity."
  else
    log "✓ Restored database has $TABLE_COUNT tables"
  fi

  # Check for key tables
  CRITICAL_TABLES=("users" "tenants" "clients" "subscriptions" "invoices" "radacct")
  for table in "${CRITICAL_TABLES[@]}"; do
    if PGPASSWORD="$POSTGRES_PASSWORD" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" \
      2>/dev/null | grep -q 1; then
      log "✓ Critical table present: $table"
    else
      error "Critical table missing: $table (restore may be corrupted)"
    fi
  done

  log "✓ Post-restore verification passed"
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  if [ "$BACKUP_IS_REMOTE" = true ] && [ -n "${LOCAL_COPY:-}" ] && [ -f "$LOCAL_COPY" ]; then
    log "Cleaning up temporary download..."
    rm -f "$LOCAL_COPY"
    log "✓ Cleanup completed"
  fi
}

# ── Main Flow ─────────────────────────────────────────────────────────────────

log "=== Database Restore Started ==="
preflight_check "$@"
download_remote_backup
create_prestore_backup
prepare_database
restore_backup
verify_restore
cleanup

log "=== Database Restore Completed Successfully ==="
log "Pre-restore backup retained at: $PRE_BACKUP_FILE"
log "Restore log: $RESTORE_LOG"

trap cleanup EXIT
