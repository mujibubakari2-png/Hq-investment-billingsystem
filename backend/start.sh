#!/bin/bash

echo "🚀 Starting HQ Investment Backend Server..."

# Install pnpm globally
npm install -g pnpm

# Start the application
cd /app/backend
pnpm run start -- --port $PORT
