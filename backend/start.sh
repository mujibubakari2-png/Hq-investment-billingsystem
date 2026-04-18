#!/bin/bash
set -e

cd "$(dirname "$0")"

# Railway injects $PORT dynamically — we must bind to it or healthchecks fail
# and Railway marks the service as "Complete" instead of "Online"
PORT="${PORT:-3001}"
export PORT

echo "🚀 Starting backend on port ${PORT}..."

# Call next start directly with the resolved PORT to guarantee it listens
# on Railway's assigned port (avoids shell-expansion issues in pnpm scripts)
exec node_modules/.bin/next start --hostname 0.0.0.0 --port "$PORT"
