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
GIT_BRANCH="master"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')

mkdir -p "$PROJECT_DIR/logs"

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

# ── 0. PM2 processes will be gracefully reloaded after build ──────────────────
# ── 1. Pull latest code ───────────────────────────────────────────────────────
if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    step "Pulling latest code from origin/$GIT_BRANCH"
    git fetch origin
    git reset --hard "origin/$GIT_BRANCH"
    ok "Code updated to $(git rev-parse --short HEAD)"
fi

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies"
pnpm install --no-frozen-lockfile
ok "Dependencies installed"

# Prevent Out-Of-Memory (OOM) errors during Next.js and Vite builds on smaller VPS instances
export NODE_OPTIONS="--max-old-space-size=1024"

# ── 2.5. Environment Check ────────────────────────────────────────────────────
step "Checking for environment variables"
MISSING_ENV=false
for env_file in "backend/.env" "frontend/.env" "landing-page/.env"; do
    if [ ! -f "$PROJECT_DIR/$env_file" ]; then
        echo "  ❌ Missing $env_file" | tee -a "$LOG_FILE"
        MISSING_ENV=true
    else
        ok "Found $env_file"
    fi
done

if [ "$MISSING_ENV" = true ]; then
    fail "One or more .env files are missing! Builds will fail. Please create them first."
fi


# ── 3. Pre-deployment setup (migrations, system checks) ─────────────────────
# These run ONCE, not per PM2 process instance
if [ "$FRONTEND_ONLY" = false ]; then
    step "Running pre-deployment setup (migrations, system checks)"
    
    # Load .env for database checks
    if [ -f "$PROJECT_DIR/backend/.env" ]; then
        set -o allexport
        source "$PROJECT_DIR/backend/.env"
        set +o allexport
    fi
    
    # Test database connection
    log "Testing database connection..."
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_PORT=${DB_PORT:-5432}
    
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
        ok "Database is reachable at $DB_HOST:$DB_PORT"
    else
        log "⚠️  Database may not be reachable — continuing anyway"
    fi
    
    # Apply Prisma migrations
    log "Applying database migrations..."
    cd "$PROJECT_DIR/backend"
    if pnpm exec prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"; then
        ok "Database migrations applied"
    else
        log "⚠️  Migrations failed or skipped (data may already exist)"
    fi
    cd "$PROJECT_DIR"
    
    ok "Pre-deployment setup complete"
fi

# ── 4. Build backend ─────────────────────────────────────────────────────────
if [ "$FRONTEND_ONLY" = false ]; then
    step "Building backend"
    BUILD_DIR=.next-temp pnpm --filter backend build 2>&1 | tee -a "$LOG_FILE" || fail "Backend build failed"
    rm -rf backend/.next
    mv backend/.next-temp backend/.next
    ok "Backend built"
fi

# ── 5. Build landing page ─────────────────────────────────────────────────────
if [ "$BACKEND_ONLY" = false ]; then
    step "Building landing page"
    BUILD_DIR=.next-temp pnpm --filter landing-page build 2>&1 | tee -a "$LOG_FILE" || fail "Landing page build failed"
    rm -rf landing-page/.next
    mv landing-page/.next-temp landing-page/.next
    ok "Landing page built"
fi

# ── 6. Build frontend (Vite SPA) ──────────────────────────────────────────────
if [ "$BACKEND_ONLY" = false ]; then
    step "Building frontend (Vite SPA)"
    pnpm --filter frontend build 2>&1 | tee -a "$LOG_FILE" || fail "Frontend build failed"
    ok "Frontend built → frontend/dist/"
fi

# ── 6. Start/Reload backend with PM2 ──────────────────────────────────────────
if [ "$FRONTEND_ONLY" = false ]; then
    step "Starting/Reloading backend with PM2"
    pm2 reload ecosystem.config.js --only backend --update-env || pm2 start ecosystem.config.js --only backend --update-env
    ok "Backend reloaded/started"
fi

# ── 7. Start/Reload landing page ───────────────────────────────────────────────
if [ "$FRONTEND_ONLY" = false ] && [ "$BACKEND_ONLY" = false ]; then
    step "Starting/Reloading landing page"
    pm2 reload ecosystem.config.js --only landing-page --update-env || pm2 start ecosystem.config.js --only landing-page --update-env
    ok "Landing page reloaded/started"
fi

# ── 9. Save PM2 state ────────────────────────────────────────────────────────
step "Saving PM2 process list"
pm2 save
ok "PM2 state saved"

# ── 9. Test & reload Nginx ────────────────────────────────────────────────────
step "Testing Nginx configuration"
sudo nginx -t 2>&1 | tee -a "$LOG_FILE" || fail "Nginx config test failed — NOT reloading"
ok "Nginx config valid"

step "Reloading Nginx"
sudo systemctl reload nginx
ok "Nginx reloaded"

# ── 10. Health check ───────────────────────────────────────────────────────────
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
