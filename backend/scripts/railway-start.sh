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

# 2. Database Verification (Lightweight)
echo "🔍 Verifying database connectivity..."
# Just a quick check to ensure we can reach the DB
pnpm exec prisma db version || echo "⚠️  Could not reach database, but attempting to start app anyway..."

# 3. Start Application
echo "🚀 Starting Next.js application on port ${PORT:-3000}..."
# Use exec to ensure the application receives signals (like SIGTERM) correctly
exec pnpm start
