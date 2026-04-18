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
echo "🚀 Starting Next.js application..."
echo "PORT environment variable: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo "Current directory: $(pwd)"
echo "Starting command: pnpm run start"
pnpm run start
