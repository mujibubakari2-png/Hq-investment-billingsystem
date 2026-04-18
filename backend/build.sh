#!/bin/bash
set -e

echo "🚀 Starting Railway backend build..."

echo "📦 Installing pnpm..."
npm install -g pnpm

echo "📦 Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "🗃️ Generating Prisma client..."
npx prisma generate

echo "🔨 Building application..."
pnpm run build

echo "✅ Build process complete."