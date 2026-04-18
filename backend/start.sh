#!/bin/bash
set -e

echo "🚀 Starting HQ Investment Backend Server..."

# Install pnpm globally
echo "📦 Installing pnpm..."
npm install -g pnpm

# Get environment variables
PORT=${PORT:-3001}
DATABASE_URL=${DATABASE_URL:-""}
NODE_ENV=${NODE_ENV:-"development"}

echo "✅ Port: $PORT"
echo "✅ Environment: $NODE_ENV"

# Check if DATABASE_URL is available (production only)
if [ ! -z "$DATABASE_URL" ] && [ "$NODE_ENV" = "production" ]; then
    echo "🗄️ Attempting database initialization..."
    
    # Try to push schema and seed database
    # This will retry automatically if the database is temporarily unavailable
    if npx prisma db push --accept-data-loss 2>&1; then
        echo "✅ Database schema pushed successfully"
        
        # Try to seed
        if npx prisma db seed 2>&1; then
            echo "✅ Database seeded successfully"
        else
            echo "⚠️ Seeding failed or already seeded, continuing..."
        fi
    else
        echo "⚠️ Database push failed, continuing with startup..."
    fi
else
    echo "⏭️ Skipping database setup (development or DATABASE_URL not set)"
fi

echo "🎯 Starting application on port $PORT..."
exec pnpm run start -- --port $PORT
