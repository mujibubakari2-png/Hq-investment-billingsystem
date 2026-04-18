#!/bin/bash
set -e

echo "🚀 Starting Railway build process..."

# Install pnpm globally
echo "📦 Installing pnpm..."
npm install -g pnpm

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Generate Prisma client
echo "🗃️ Generating Prisma client..."
npx prisma generate

# Build the application
echo "🔨 Building application..."
pnpm run build

echo "✅ Build process complete! Database setup will happen during deployment."