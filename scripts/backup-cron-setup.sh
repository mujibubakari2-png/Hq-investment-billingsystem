#!/bin/bash
# =============================================================================
# Database Backup Cron Setup — HQ Investment ISP Platform
# 
# Purpose: Configure automated daily database backups via cron
# 
# Installation:
#   sudo bash scripts/backup-cron-setup.sh
#
# This script:
#   1. Creates backup directory with proper permissions
#   2. Adds cron job for daily 2 AM backups
#   3. Verifies rclone is installed
#   4. Tests backup script
#   5. Creates log rotation config
#
# =============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗ ERROR:${NC} $*" >&2; exit 1; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_DIR="${1:-/var/backups/hq-investment}"
BACKUP_SCRIPT="${2:-/var/www/Hq-investment-billingsystem/scripts/backup-db.sh}"
LOG_FILE="/var/log/hq-backup.log"

# Verify running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use: sudo bash scripts/backup-cron-setup.sh)"
fi

log "Setting up automated database backup..."

# ── Step 1: Create backup directory ────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"
log "Created backup directory: $BACKUP_DIR"

# ── Step 2: Verify backup script exists ────────────────────────────────────────
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
   error "Backup script not found: $BACKUP_SCRIPT"
fi
chmod +x "$BACKUP_SCRIPT"
log "Backup script verified: $BACKUP_SCRIPT"

# ── Step 3: Check dependencies ─────────────────────────────────────────────────
if ! command -v pg_dump &> /dev/null; then
   warn "pg_dump not found. Install with: apt-get install -y postgresql-client"
fi

if ! command -v rclone &> /dev/null; then
   warn "rclone not found. Install with: curl https://rclone.org/install.sh | sudo bash"
fi

# ── Step 4: Create log file ───────────────────────────────────────────────────
touch "$LOG_FILE"
chmod 640 "$LOG_FILE"
log "Created log file: $LOG_FILE"

# ── Step 5: Add cron job (daily 2 AM) ─────────────────────────────────────────
CRON_SCHEDULE="0 2 * * *"
CRON_ENTRY="$CRON_SCHEDULE $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

# Remove existing entry if present
crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab - 2>/dev/null || true

# Add new entry
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
log "Added cron job: Daily backup at 2:00 AM"

# ── Step 6: Create logrotate config ───────────────────────────────────────────
cat > /etc/logrotate.d/hq-backup << 'EOF'
/var/log/hq-backup.log {
    weekly
    missingok
    rotate 12
    compress
    delaycompress
    notifempty
    create 640 root root
    sharedscripts
}
EOF
log "Configured log rotation (weekly, 12-week retention)"

# ── Step 7: Test backup script ────────────────────────────────────────────────
warn "Testing backup script (this may take 1-2 minutes)..."
if bash "$BACKUP_SCRIPT"; then
   log "Backup test completed successfully"
else
   error "Backup test failed. Check configuration and try again."
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Backup automation configured!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Backup Location:     $BACKUP_DIR"
echo "Backup Schedule:     Daily at 2:00 AM"
echo "Log Location:        $LOG_FILE"
echo ""
echo "Verify cron job:"
echo "  crontab -l | grep backup-db.sh"
echo ""
echo "View backup logs:"
echo "  tail -f $LOG_FILE"
echo ""
echo "Run backup manually (test):"
echo "  $BACKUP_SCRIPT"
echo ""
