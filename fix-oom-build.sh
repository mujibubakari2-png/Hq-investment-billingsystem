#!/bin/bash
# fix-oom-build.sh
# Run this on the droplet if `pnpm build:all` is killed with exit 137 (OOM).
# It adds 2 GB swap, then re-runs only the frontend build.

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " HQ Investment — OOM Build Fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Add swap (idempotent) ───────────────────────────────────────────────
echo ""
echo "💾 Step 1: Checking / creating swap..."
if free | awk '/^Swap:/ {exit !$2}'; then
  SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
  echo "  ✅ Swap already active (${SWAP_TOTAL} MB) — skipping."
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  # Make it permanent across reboots
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  sudo sysctl -w vm.swappiness=10
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  echo "  ✅ 2 GB swap created and enabled."
fi

free -h | grep -E 'Mem|Swap'

# ── 2. Re-run the frontend build only ─────────────────────────────────────
echo ""
echo "🔨 Step 2: Building frontend (with 1536 MB Node heap cap)..."
cd "$(dirname "$0")"

pnpm --filter frontend build

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ Frontend build succeeded!"
echo " Next: copy dist files to Nginx web root"
echo "   cp -r frontend/dist/* /var/www/html/billing/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
