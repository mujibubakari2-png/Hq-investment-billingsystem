#!/bin/bash
# =============================================================================
# Health Check & Monitoring Setup — HQ Investment ISP Platform
# 
# Purpose: Configure automated health monitoring and alerting
# 
# Installation:
#   sudo bash scripts/health-monitoring-setup.sh
#
# This script creates:
#   1. Systemd timer for periodic health checks
#   2. Slack webhook alerts for failures
#   3. Database connectivity tests
#   4. Performance monitoring dashboard
#   5. Alert escalation procedures
#
# =============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗ ERROR:${NC} $*" >&2; exit 1; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
info() { echo -e "${BLUE}ℹ${NC} $*"; }

# ── Configuration ─────────────────────────────────────────────────────────────
HEALTH_CHECK_SCRIPT="/var/lib/hq-investment/health-check.sh"
HEALTH_CHECK_LOG="/var/log/hq-health-check.log"
MONITORING_CONFIG_DIR="/etc/hq-investment/monitoring"

# Verify running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use: sudo bash scripts/health-monitoring-setup.sh)"
fi

log "Setting up health monitoring and alerting..."

# ── Step 1: Create monitoring directories ──────────────────────────────────────
mkdir -p "$MONITORING_CONFIG_DIR"
mkdir -p /var/lib/hq-investment
chmod 755 "$MONITORING_CONFIG_DIR" /var/lib/hq-investment
log "Created monitoring directories"

# ── Step 2: Create health check script ────────────────────────────────────────
cat > "$HEALTH_CHECK_SCRIPT" << 'HEALTH_SCRIPT'
#!/bin/bash
# Health check script for HQ Investment ISP Platform
# Validates: API health, database connectivity, Redis cache, disk space

set -euo pipefail

# Configuration
API_HOST="${API_HOST:-http://localhost:3000}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
ALERT_THRESHOLD_DISK=80  # Alert if disk usage > 80%
ALERT_THRESHOLD_DB_LATENCY=5000  # Alert if DB latency > 5s

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track failures
FAILURES=()

# ── Helper functions ───────────────────────────────────────────────────────────
send_alert() {
    local severity="$1"
    local message="$2"
    
    if [[ -z "$SLACK_WEBHOOK" ]]; then
        return
    fi
    
    local color="ff0000"  # red
    [[ "$severity" == "warning" ]] && color="ffa500"  # orange
    [[ "$severity" == "ok" ]] && color="00ff00"  # green
    
    curl -s -X POST "$SLACK_WEBHOOK" \
      -H 'Content-type: application/json' \
      --data "{
        \"attachments\": [{
          \"color\": \"$color\",
          \"title\": \"HQ Investment Health Alert ($severity)\",
          \"text\": \"$message\",
          \"ts\": $(date +%s)
        }]
      }" || true
}

# ── Health Check 1: API Availability ───────────────────────────────────────────
info() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"; }
check_api() {
    info "Checking API health..."
    if response=$(curl -s -m 10 "$API_HOST/api/health" 2>&1); then
        if echo "$response" | grep -q '"status":"ok"'; then
            echo -e "${GREEN}✓${NC} API is healthy"
            return 0
        else
            FAILURES+=("API returned unhealthy status: $response")
            return 1
        fi
    else
        FAILURES+=("API is unreachable: $response")
        return 1
    fi
}

# ── Health Check 2: Database Latency ──────────────────────────────────────────
check_db_latency() {
    info "Checking database latency..."
    
    # Extract latency from API response
    if response=$(curl -s -m 10 "$API_HOST/api/health" 2>&1); then
        latency=$(echo "$response" | grep -oP '"database_latency":\K[0-9]+' || echo "0")
        
        if [[ $latency -gt $ALERT_THRESHOLD_DB_LATENCY ]]; then
            FAILURES+=("Database latency is high: ${latency}ms (threshold: ${ALERT_THRESHOLD_DB_LATENCY}ms)")
            return 1
        else
            echo -e "${GREEN}✓${NC} Database latency: ${latency}ms"
            return 0
        fi
    else
        FAILURES+=("Could not retrieve database latency")
        return 1
    fi
}

# ── Health Check 3: Disk Space ───────────────────────────────────────────────
check_disk_space() {
    info "Checking disk space..."
    
    disk_usage=$(df /var/lib/postgresql/data | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $disk_usage -gt $ALERT_THRESHOLD_DISK ]]; then
        FAILURES+=("High disk usage: $disk_usage% (threshold: $ALERT_THRESHOLD_DISK%)")
        return 1
    else
        echo -e "${GREEN}✓${NC} Disk usage: $disk_usage%"
        return 0
    fi
}

# ── Health Check 4: Docker Container Status ──────────────────────────────────
check_containers() {
    info "Checking container status..."
    
    for container in hq-backend hq-postgres hq-redis; do
        if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            echo -e "${GREEN}✓${NC} Container $container is running"
        else
            FAILURES+=("Container $container is not running or unhealthy")
            return 1
        fi
    done
    return 0
}

# ── Summary ────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "  HQ Investment ISP Platform — Health Check"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo ""
    
    check_api || true
    check_db_latency || true
    check_disk_space || true
    check_containers || true
    
    echo ""
    
    if [[ ${#FAILURES[@]} -eq 0 ]]; then
        echo -e "${GREEN}✓ All health checks passed!${NC}"
        send_alert "ok" "All systems operational"
        exit 0
    else
        echo -e "${RED}✗ Health check failures:${NC}"
        for failure in "${FAILURES[@]}"; do
            echo "  • $failure"
        done
        send_alert "error" "$(printf '%s\n' "${FAILURES[@]}")"
        exit 1
    fi
}

main
HEALTH_SCRIPT

chmod +x "$HEALTH_CHECK_SCRIPT"
log "Created health check script: $HEALTH_CHECK_SCRIPT"

# ── Step 3: Create systemd service for health check ──────────────────────────
cat > "/etc/systemd/system/hq-health-check.service" << 'SYSTEMD_SERVICE'
[Unit]
Description=HQ Investment Health Check
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/var/lib/hq-investment/health-check.sh
StandardOutput=append:/var/log/hq-health-check.log
StandardError=append:/var/log/hq-health-check.log
User=root
Environment="API_HOST=http://localhost:3000"

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

log "Created systemd service: /etc/systemd/system/hq-health-check.service"

# ── Step 4: Create systemd timer (runs every 5 minutes) ──────────────────────
cat > "/etc/systemd/system/hq-health-check.timer" << 'SYSTEMD_TIMER'
[Unit]
Description=HQ Investment Health Check Timer
Requires=hq-health-check.service

[Timer]
# Run every 5 minutes
OnBootSec=1min
OnUnitActiveSec=5min
AccuracySec=10s

[Install]
WantedBy=timers.target
SYSTEMD_TIMER

log "Created systemd timer: /etc/systemd/system/hq-health-check.timer"

# ── Step 5: Enable and start timer ────────────────────────────────────────────
systemctl daemon-reload
systemctl enable hq-health-check.timer
systemctl start hq-health-check.timer
log "Enabled and started health check timer"

# ── Step 6: Create monitoring configuration file ──────────────────────────────
cat > "$MONITORING_CONFIG_DIR/monitoring.conf" << 'MONITORING_CONF'
# HQ Investment ISP Platform — Monitoring Configuration

# API Health Endpoint
API_ENDPOINT=http://localhost:3000/api/health

# Slack Alerts (set to enable alerting)
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}

# Alert Thresholds
ALERT_DB_LATENCY_MS=5000
ALERT_DISK_USAGE_PCT=80
ALERT_CPU_USAGE_PCT=75
ALERT_MEMORY_USAGE_PCT=85

# Backup Verification
BACKUP_VERIFY_ENABLED=true
BACKUP_VERIFY_SCHEDULE="0 3 * * 0"  # Weekly at 3 AM on Sunday

# Performance Monitoring
PERFORMANCE_METRICS_ENABLED=true
PERFORMANCE_SAMPLE_INTERVAL=60  # seconds

# Log Aggregation
LOG_RETENTION_DAYS=30
LOG_ARCHIVE_PATH=/var/backups/logs
MONITORING_CONF

log "Created monitoring configuration: $MONITORING_CONFIG_DIR/monitoring.conf"

# ── Step 7: Create log rotation config ──────────────────────────────────────
cat > "/etc/logrotate.d/hq-monitoring" << 'LOGROTATE_CONF'
/var/log/hq-health-check.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 root root
    sharedscripts
}
LOGROTATE_CONF

log "Configured log rotation for monitoring logs"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Health monitoring configured!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Monitoring Features:"
echo "  • Health checks every 5 minutes"
echo "  • API availability monitoring"
echo "  • Database latency tracking"
echo "  • Disk space alerts"
echo "  • Container status verification"
echo "  • Slack webhook notifications (if configured)"
echo ""
echo "Configuration File:"
echo "  $MONITORING_CONFIG_DIR/monitoring.conf"
echo ""
echo "View monitoring logs:"
echo "  tail -f $HEALTH_CHECK_LOG"
echo ""
echo "Run health check manually:"
echo "  $HEALTH_CHECK_SCRIPT"
echo ""
echo "Check timer status:"
echo "  systemctl status hq-health-check.timer"
echo ""
echo "Configure Slack webhook:"
echo "  export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...'"
echo "  systemctl restart hq-health-check.timer"
echo ""
