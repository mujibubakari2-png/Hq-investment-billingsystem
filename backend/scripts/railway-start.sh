#!/bin/bash

echo "🚀 Starting Railway Backend Deployment..."

# 1. Environment Check
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL is not set. Database features will fail."
fi

# 2. START THE APPLICATION
# Migrations are handled by the pre-deploy command (prisma db push).
echo "🚀 Starting Next.js application on port ${PORT:-3000}..."
pnpm start
