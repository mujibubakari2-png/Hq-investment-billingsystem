#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ -z "$PORT" ]; then
  echo "⚠️ PORT is not set, falling back to 3001"
fi

echo "🚀 Starting backend on port ${PORT:-3001}..."
exec pnpm run start
