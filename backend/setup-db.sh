#!/bin/bash
set -e

echo "🗄️ Setting up database during deployment..."

# Check if DATABASE_URL is available
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set, cannot setup database"
    exit 1
fi

echo "Database URL is available: ${DATABASE_URL:0:50}..."

echo "Testing database connection..."
npx prisma db execute --stdin <<'EOF'
SELECT 1 as connection_test;
EOF

echo "✅ Database connection successful"

echo "Checking if database schema exists..."
TABLE_COUNT=$(npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
EOF
)

if echo "$TABLE_COUNT" | grep -q "table_count.*0"; then
    echo "📋 Database is empty, setting up schema..."
    echo "Pushing database schema..."
    npx prisma db push --accept-data-loss
    echo "Seeding database with initial data..."
    npx prisma db seed
    echo "✅ Database setup complete!"
else
    echo "ℹ️ Database schema already exists, skipping setup"
fi

echo "🎉 Database is ready for application startup!"

# Clean disconnect from database before app startup
if [ -n "$DATABASE_URL" ]; then
    echo "Disconnecting from database pool..."
    # This ensures all connections are closed before the app starts
    sleep 1
fi

exit 0