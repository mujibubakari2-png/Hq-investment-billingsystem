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

echo "🎯 Starting application on port $PORT..."
exec pnpm run start -- --port $PORT
