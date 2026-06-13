#!/bin/bash
# =============================================================================
# Database Backup Script — HQ Investment ISP Platform
# DO-003 FIX: Automated database backups to DigitalOcean Spaces
#
# Setup:
#   1. Install rclone: curl https://rclone.org/install.sh | sudo bash
#   2. Configure: rclone config (add DigitalOcean Spaces as S3-compatible remote)
#   3. Create Spaces bucket: hq-investment-backups
#   4. Add to crontab: 0 2 * * * /var/www/Hq-investment-billingsystem/scripts/backup-db.sh
#   5. Make executable: chmod +x scripts/backup-db.sh
#
# Environment variables (set in /etc/environment or source from .env):
#   POSTGRES_USER       - Database user (default: hqinvestment_user)
#   POSTGRES_DB         - Database name (default: hqinvestment_isp)
#   BACKUP_BUCKET       - Spaces bucket name (default: hq-investment-backups)
#   BACKUP_RCLONE_REMOTE - rclone remote name (default: spaces)
#   BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)
#   SLACK_WEBHOOK_URL   - Optional Slack webhook for alerts
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
DB_USER="${POSTGRES_USER:-hqinvestment_user}"
DB_NAME="${POSTGRES_DB:-hqinvestment_isp}"
BACKUP_DIR="/var/backups/hq-investment"
BUCKET="${BACKUP_BUCKET:-hq-investment-backups}"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-spaces}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
LOG_FILE="/var/log/hq-backup.log"

# ── Logging ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
error() { log "ERROR: $*"; send_alert "❌ DB Backup FAILED: $*"; exit 1; }

# ── Slack Alert (optional) ────────────────────────────────────────────────────
send_alert() {
  local message="$1"
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"[HQ Investment Backup] ${message}\"}" || true
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
log "=== Starting database backup ==="
log "Database: ${DB_NAME} | Target: ${RCLONE_REMOTE}:${BUCKET}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Run pg_dump and compress
log "Running pg_dump..."
if ! pg_dump \
  --username="$DB_USER" \
  --host=127.0.0.1 \
  --port=5432 \
  --no-password \
  --format=custom \
  "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  error "pg_dump failed"
fi

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Upload to DigitalOcean Spaces
log "Uploading to Spaces..."
if ! rclone copy "$BACKUP_FILE" "${RCLONE_REMOTE}:${BUCKET}/database/" \
  --progress \
  --stats-one-line 2>> "$LOG_FILE"; then
  error "Upload to Spaces failed"
fi
log "Upload complete"

# Prune local backups older than retention period
log "Pruning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
log "Local pruning done"

# Prune remote backups older than retention period
log "Pruning remote backups older than ${RETENTION_DAYS} days..."
rclone delete "${RCLONE_REMOTE}:${BUCKET}/database/" \
  --min-age "${RETENTION_DAYS}d" \
  --include "db_backup_*.sql.gz" 2>> "$LOG_FILE" || true

# Done
log "=== Backup completed successfully ==="
log "File: ${BACKUP_FILE} | Size: ${BACKUP_SIZE}"
send_alert "✅ DB Backup SUCCESS — ${DB_NAME} (${BACKUP_SIZE}) @ ${TIMESTAMP}"
