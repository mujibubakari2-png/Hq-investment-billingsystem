#!/bin/bash

echo "🚀 Starting HQ Investment Backend Server..."

# Install pnpm globally
npm install -g pnpm

# Database setup (only in production with DATABASE_URL)
if [ ! -z "$DATABASE_URL" ] && [ "$NODE_ENV" = "production" ]; then
    echo "🗄️ Setting up database..."
    cd /app/backend

    # Push schema to database
    echo "📋 Pushing database schema..."
    npx prisma db push --accept-data-loss 2>&1 | grep -v "npm warn" || true

    # Seed database
    echo "🌱 Seeding database..."
    npx prisma db seed 2>&1 | grep -v "npm warn" || true

    echo "✅ Database setup complete"
else
    echo "⏭️ Skipping database setup (development or DATABASE_URL not set)"
fi

# Start the application
cd /app/backend
pnpm run start -- --port $PORT
