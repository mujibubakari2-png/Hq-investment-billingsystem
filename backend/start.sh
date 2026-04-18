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
    echo "🗄️ Checking database connection..."
    MAX_RETRIES=5
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if npx prisma db execute --stdin <<EOF 2>/dev/null >/dev/null; SELECT 1;
EOF
        then
            echo "✅ Database connection successful"
            
            # Check if schema exists
            SCHEMA_EMPTY=$(npx prisma db execute --stdin <<EOF 2>/dev/null | grep -c "0 rows"
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
EOF
)
            
            if [ "$SCHEMA_EMPTY" = "1" ]; then
                echo "📋 Database is empty, setting up schema and seeding..."
                npx prisma db push --accept-data-loss 2>&1 | grep -v "npm warn" || true
                npx prisma db seed 2>&1 | grep -v "npm warn" || true
                echo "✅ Database setup complete"
            else
                echo "✅ Database schema already exists"
            fi
            
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
            sleep 5
        fi
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "⚠️ Could not connect to database after $MAX_RETRIES attempts, continuing with startup..."
    fi
else
    echo "⏭️ Skipping database setup (development or DATABASE_URL not set)"
fi

echo "🎯 Starting application..."
pnpm run start -- --port $PORT

exit 0
