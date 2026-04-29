#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Kenge ISP Billing — DigitalOcean Droplet Start Script
# Primary start script for Droplet deployments
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit immediately on error

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

echo "📁 Working directory: $BACKEND_DIR"

# ── 1. Load .env file ────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    echo "✅ Loading environment from $ENV_FILE"
    # Export all variables from .env (skip comments and blank lines)
    set -o allexport
    source "$ENV_FILE"
    set +o allexport
else
    echo "❌ ERROR: .env file not found at $ENV_FILE"
    echo "   Please create it: cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env"
    echo "   Then fill in DATABASE_URL, JWT_SECRET, etc."
    exit 1
fi

# ── 2. Validate required environment variables ───────────────────────────────
MISSING_VARS=0

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set in .env"
    MISSING_VARS=1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ ERROR: JWT_SECRET is not set in .env"
    MISSING_VARS=1
fi

if [ "$MISSING_VARS" -eq 1 ]; then
    echo "   Fix your .env file and restart."
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo "✅ JWT_SECRET is set"

# ── 3. Test database connection ──────────────────────────────────────────────
echo "🔌 Testing database connection..."
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_PORT=${DB_PORT:-5432}

if pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
    echo "✅ Database is reachable at $DB_HOST:$DB_PORT"
else
    echo "⚠️  WARNING: Database may not be reachable at $DB_HOST:$DB_PORT"
    echo "   The app will still start, but DB operations will fail."
    echo "   Check: sudo systemctl status postgresql"
fi

# ── 4. Ensure WireGuard VPN is running (needed for MikroTik connectivity) ────
echo "🔒 Checking WireGuard VPN status..."
if command -v wg &> /dev/null; then
    if systemctl is-active --quiet wg-quick@wg0; then
        echo "✅ WireGuard wg0 is already running"
        echo "   Peers connected: $(sudo wg show wg0 peers 2>/dev/null | wc -l)"
    else
        echo "⚠️  WireGuard wg0 is NOT running — restarting..."
        sudo systemctl restart wg-quick@wg0
        sleep 2
        if systemctl is-active --quiet wg-quick@wg0; then
            echo "✅ WireGuard wg0 restarted successfully (UDP port 51820)"
        else
            echo "❌ WARNING: WireGuard failed to start — MikroTik routers using VPN tunnel will be UNREACHABLE"
            echo "   Run: sudo systemctl status wg-quick@wg0 to diagnose"
        fi
    fi
else
    echo "ℹ️  WireGuard not installed — skipping VPN check (direct-connect routers will still work)"
fi

# ── 5. Apply Prisma migrations safely ────────────────────────────────────────
echo "🔧 Applying database migrations (prisma migrate deploy)..."
if pnpm exec prisma migrate deploy; then
    echo "✅ Database migrations applied"
else
    echo "❌ Migration failed — refusing to start to avoid schema drift"
    exit 1
fi

# ── 5. Seed database (only if empty) ─────────────────────────────────────────
echo "🌱 Running database seed (safe — skips if data exists)..."
if pnpm exec tsx scripts/seed.ts; then
    echo "✅ Seed complete"
else
    echo "⚠️  Seed failed or skipped (data may already exist)"
fi

# ── 6. Start the Next.js production server ───────────────────────────────────
echo ""
echo "🚀 Starting Kenge ISP Backend on port ${PORT:-3000}..."
echo "   NODE_ENV: ${NODE_ENV:-production}"
echo "   HOST:     0.0.0.0"
echo "   PORT:     ${PORT:-3000}"
echo ""

exec pnpm run next:start
