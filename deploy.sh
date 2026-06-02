#!/bin/bash
# =============================================================================
# deploy.sh — Zero-Downtime Production Deployment Script
# HQ Investment Billing System
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                    # deploy everything
#   ./deploy.sh --backend-only     # only reload backend
#   ./deploy.sh --frontend-only    # only rebuild frontend
#
# Requirements on the VPS:
#   - git, pnpm, pm2 installed
#   - sudo nginx -t and sudo systemctl reload nginx without password:
#     echo "ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx" \
#       | sudo tee /etc/sudoers.d/nginx-reload
# =============================================================================

set -euo pipefail  # exit on error, undefined var, or pipe failure

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_DIR="/var/www/Hq-investment-billingsystem"
LOG_FILE="$PROJECT_DIR/logs/deploy.log"
GIT_BRANCH="main"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')

# ── Argument parsing ──────────────────────────────────────────────────────────
BACKEND_ONLY=false
FRONTEND_ONLY=false
for arg in "$@"; do
    case $arg in
        --backend-only)  BACKEND_ONLY=true  ;;
        --frontend-only) FRONTEND_ONLY=true ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "  $1" | tee -a "$LOG_FILE"; }
step() { echo "" | tee -a "$LOG_FILE"; echo "▶ $1" | tee -a "$LOG_FILE"; }
ok()   { echo "  ✅ $1" | tee -a "$LOG_FILE"; }
fail() { echo "  ❌ $1" | tee -a "$LOG_FILE"; exit 1; }

# ── Start ─────────────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "🚀 Deployment started: $TIMESTAMP"                  | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR" || fail "Cannot cd to $PROJECT_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    step "Pulling latest code from origin/$GIT_BRANCH"
    git fetch origin
    git reset --hard "origin/$GIT_BRANCH"
    ok "Code updated to $(git rev-parse --short HEAD)"
fi

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies"
pnpm install --frozen-lockfile
ok "Dependencies installed"

# ── 3. Build backend ─────────────────────────────────────────────────────────
if [ "$FRONTEND_ONLY" = false ]; then
    step "Building backend"
    pnpm run build --filter=backend 2>&1 | tee -a "$LOG_FILE" || fail "Backend build failed"
    ok "Backend built"
fi

# ── 4. Build frontend (Vite SPA) ──────────────────────────────────────────────
if [ "$BACKEND_ONLY" = false ]; then
    step "Building frontend (Vite SPA)"
    pnpm run build --filter=frontend 2>&1 | tee -a "$LOG_FILE" || fail "Frontend build failed"
    ok "Frontend built → frontend/dist/"
fi

# ── 5. Reload backend (zero downtime via cluster mode) ────────────────────────
if [ "$FRONTEND_ONLY" = false ]; then
    step "Reloading backend (zero-downtime)"
    pm2 reload ecosystem.config.js --only backend --update-env
    ok "Backend reloaded"
fi

# ── 6. Restart landing page ───────────────────────────────────────────────────
if [ "$FRONTEND_ONLY" = false ] && [ "$BACKEND_ONLY" = false ]; then
    step "Restarting landing page"
    pm2 restart ecosystem.config.js --only landing-page --update-env
    ok "Landing page restarted"
fi

# ── 7. Save PM2 state ────────────────────────────────────────────────────────
step "Saving PM2 process list"
pm2 save
ok "PM2 state saved"

# ── 8. Test & reload Nginx ────────────────────────────────────────────────────
step "Testing Nginx configuration"
sudo nginx -t 2>&1 | tee -a "$LOG_FILE" || fail "Nginx config test failed — NOT reloading"
ok "Nginx config valid"

step "Reloading Nginx"
sudo systemctl reload nginx
ok "Nginx reloaded"

# ── 9. Health check ───────────────────────────────────────────────────────────
step "Running health checks"
sleep 2  # give Node.js a moment to warm up

# Check backend process is running
if pm2 show backend | grep -q "online"; then
    ok "Backend: online"
else
    fail "Backend process is NOT online — check: pm2 logs backend"
fi

if pm2 show landing-page | grep -q "online"; then
    ok "Landing page: online"
else
    log "⚠️  Landing page not online (may be expected if using static Nginx serving)"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "✅ Deployment complete: $(date '+%Y-%m-%d %H:%M:%S %Z')" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo ""
log "Run 'pm2 monit' to watch live CPU/memory"
log "Run 'pm2 logs' to tail all logs"
