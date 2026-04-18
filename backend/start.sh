#!/bin/bash
set -e

echo "🚀 Starting HQ Investment Backend Server..."

# Install pnpm globally
echo "📦 Installing pnpm..."
npm install -g pnpm

# Get environment variables
PORT=${PORT:-3001}
NODE_ENV=${NODE_ENV:-"development"}

echo "✅ Port: $PORT"
echo "✅ Environment: $NODE_ENV"

# Test database connection if in production
if [ "$NODE_ENV" = "production" ]; then
    echo "🗄️ Testing database connection..."
    if echo "SELECT 1;" | npx prisma db execute --stdin 2>/dev/null; then
        echo "✅ Database connection successful"
    else
        echo "⚠️ Database connection failed, but continuing with startup..."
    fi
fi

echo "🎯 Starting application on port $PORT..."
exec pnpm run start -- --port $PORT
