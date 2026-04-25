#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Kenge ISP Billing — DigitalOcean Droplet Start Script
# Replaces railway-start.sh for Droplet deployments
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

# ── 4. Run Prisma DB sync ────────────────────────────────────────────────────
echo "🔧 Syncing database schema (prisma db push)..."
if pnpm exec prisma db push --accept-data-loss; then
    echo "✅ Schema sync successful"
else
    echo "⚠️  Schema sync failed — continuing anyway (DB may already be up to date)"
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
