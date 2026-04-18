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

# Database setup (only if DATABASE_URL is available)
if [ -n "$DATABASE_URL" ]; then
    echo "🗄️ Setting up database..."
    echo "Pushing schema..."
    npx prisma db push --accept-data-loss
    echo "Seeding database..."
    npx prisma db seed
    echo "✅ Database setup complete"
else
    echo "⚠️ DATABASE_URL not set, skipping database setup"
fi

echo "✅ Build process complete!"