#!/bin/bash
set -e

echo "🚀 Starting Railway Backend Deployment..."

# 1. Environment Check
echo "📋 Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set."
    echo "Please ensure you have linked a PostgreSQL database and the DATABASE_URL variable is available."
    exit 1
fi

# 2. Database Sync
echo "🔍 Checking Prisma client..."
if [ ! -d "src/generated/prisma" ]; then
    echo "⚠️  Prisma client not found in src/generated/prisma. Generating now..."
    pnpm exec prisma generate
fi

echo "🔧 Syncing database schema with Prisma..."
# Check if DATABASE_URL is pointing to localhost but we are in production
if [[ "$DATABASE_URL" == *"localhost"* || "$DATABASE_URL" == *"127.0.0.1"* ]] && [[ "$NODE_ENV" == "production" ]]; then
    echo "⚠️  WARNING: DATABASE_URL contains localhost/127.0.0.1 but NODE_ENV is production."
    echo "This might cause connection issues if the database is not in the same container."
fi

# Use db push for faster sync in dev/test environments, fallback to migrate
if ! pnpm exec prisma db push --accept-data-loss; then
    echo "⚠️  db push failed, trying migrate deploy..."
    pnpm exec prisma migrate deploy --skip-verify
fi

# 3. Seeding
echo "🌱 Running database seed..."
if ! pnpm exec tsx scripts/seed.ts; then
    echo "⚠️  Seed script failed, but continuing to start application..."
fi

# 4. Final Diagnostics
echo "✅ Database preparation completed."

# 5. Start Application
echo "🚀 Starting Next.js application on port ${PORT:-3000}..."
# Use exec to ensure the application receives signals (like SIGTERM) correctly
exec pnpm start
