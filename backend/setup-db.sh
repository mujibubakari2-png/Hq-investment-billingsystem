#!/bin/bash
set -e

echo "🗄️ Setting up database during deployment..."

# Check if DATABASE_URL is available
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set, cannot setup database"
    exit 1
fi

echo "Database URL is available: ${DATABASE_URL:0:50}..."

# Test database connection
echo "Testing database connection..."
npx prisma db execute --stdin <<EOF
SELECT 1 as connection_test;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Check if database is already set up
echo "Checking if database schema exists..."
TABLE_COUNT=$(npx prisma db execute --stdin <<EOF
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
EOF
)

if echo "$TABLE_COUNT" | grep -q "table_count.*0"; then
    echo "📋 Database is empty, setting up schema..."

    # Push schema
    echo "Pushing database schema..."
    npx prisma db push --accept-data-loss

    # Seed database
    echo "Seeding database with initial data..."
    npx prisma db seed

    echo "✅ Database setup complete!"
else
    echo "ℹ️ Database schema already exists, skipping setup"
fi

echo "🎉 Database ready for application startup!"