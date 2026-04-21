#!/bin/bash

echo "🚀 Starting Railway Backend Deployment..."

# 1. Environment Check
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL is not set. Database features will fail."
fi

# 2. START TAILSCALE (If Auth Key is provided)
if [ -n "$TAILSCALE_AUTHKEY" ]; then
    echo "🌐 Starting Tailscale..."
    # Ensure /dev/net/tun exists (needed for Tailscale in some environments)
    mkdir -p /dev/net
    if [ ! -c /dev/net/tun ]; then
        mknod /dev/net/tun c 10 200 || echo "⚠️ Could not create /dev/net/tun. Tailscale might run in userspace-networking mode."
    fi

    # Start tailscaled in the background
    # --tun=userspace-networking is used as a fallback if TUN is not available
    tailscaled --tun=userspace-networking --socks5-server=localhost:1055 --outbound-http-proxy-listen=localhost:1055 &
    
    # Wait for tailscaled to be ready
    sleep 2
    
    # Authenticate and bring up the interface
    echo "🔑 Authenticating with Tailscale..."
    tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="kenge-backend" --accept-routes
    
    echo "✅ Tailscale is active."
fi

# 3. START THE APPLICATION IN THE BACKGROUND
echo "🚀 Starting Next.js application on port ${PORT:-3000}..."
pnpm run next:start &
APP_PID=$!

# 4. RUN DATABASE TASKS IN PARALLEL
# We use a subshell in the background so it doesn't block the health check
(
    echo "🔧 [Background] Starting database preparation..."
    
    # Wait a few seconds to let the app bind to the port first
    sleep 5
    
    if [ -n "$DATABASE_URL" ]; then
        echo "🔧 [Background] Syncing database schema (prisma db push)..."
        if pnpm exec prisma db push --accept-data-loss; then
            echo "✅ [Background] Schema sync successful."
            
            echo "🌱 [Background] Seeding database..."
            if pnpm exec tsx scripts/seed.ts; then
                echo "✅ [Background] Seeding successful."
            else
                echo "❌ [Background] Seeding failed."
            fi
        else
            echo "❌ [Background] Schema sync failed."
        fi
    fi
    
    echo "📊 [Background] Data verification:"
    pnpm exec tsx -e '
import { PrismaClient } from "./src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function check() {
  if (!process.env.DATABASE_URL) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const userCount = await prisma.user.count();
    console.log(`📈 Current user count: ${userCount}`);
  } catch (e) {
    console.log("❌ Verification failed:", e.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
check();
'
) &

# 5. WAIT FOR THE APPLICATION PROCESS
# This keeps the container running and logs the app output
wait $APP_PID
