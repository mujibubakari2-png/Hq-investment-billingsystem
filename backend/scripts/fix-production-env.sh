#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# fix-production-env.sh
# Adds missing RADIUS/WireGuard variables to the production .env file.
# Run ONCE on the Droplet:
#   sudo bash backend/scripts/fix-production-env.sh
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    Patching Production .env — RADIUS Variables       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env not found at $ENV_FILE"
    exit 1
fi

# ── Helper: add variable if not already present ───────────────────────────────
add_if_missing() {
    local KEY="$1"
    local VALUE="$2"
    if grep -q "^${KEY}=" "$ENV_FILE" 2>/dev/null; then
        echo "ℹ️  $KEY already set — skipping"
    else
        echo "${KEY}=${VALUE}" >> "$ENV_FILE"
        echo "✅ Added: ${KEY}=${VALUE}"
    fi
}

# ── Detect WireGuard server IP (wg0 interface) ────────────────────────────────
WG_IP=$(ip addr show wg0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
if [ -z "$WG_IP" ]; then
    WG_IP="10.0.0.1"  # default
    echo "⚠️  WireGuard interface wg0 not found. Using default $WG_IP"
else
    echo "✅ Detected WireGuard IP: $WG_IP"
fi

# ── Detect Droplet public IP ──────────────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 http://ifconfig.me 2>/dev/null || echo "")
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --max-time 5 http://api.ipify.org 2>/dev/null || echo "")
fi
echo "✅ Detected public IP: ${PUBLIC_IP:-unknown}"

echo ""
echo "📝 Adding missing variables to $ENV_FILE..."
echo ""

# ── RADIUS variables ──────────────────────────────────────────────────────────
add_if_missing "RADIUS_NAS_SECRET"    "hqinvestment_radius_secret"
add_if_missing "WG_SERVER_IP"         "$WG_IP"
add_if_missing "SERVER_PUBLIC_IP"     "${PUBLIC_IP:-10.0.0.1}"
add_if_missing "DROPLET_IP"           "${PUBLIC_IP:-10.0.0.1}"
add_if_missing "MIKROTIK_TIMEOUT_MS"  "8000"
add_if_missing "MIKROTIK_USE_HTTPS"   "false"
add_if_missing "MIKROTIK_INSECURE"    "false"

# ── APP_URL (critical for payment callbacks) ──────────────────────────────────
if ! grep -q "^APP_URL=" "$ENV_FILE" 2>/dev/null; then
    if [ -n "$PUBLIC_IP" ]; then
        echo "APP_URL=http://${PUBLIC_IP}" >> "$ENV_FILE"
        echo "✅ Added: APP_URL=http://${PUBLIC_IP}"
        echo "   ⚠️  Update this to your domain if you use one (e.g. https://billing.yourdomain.com)"
    else
        echo "APP_URL=http://YOUR_DROPLET_IP" >> "$ENV_FILE"
        echo "⚠️  Set APP_URL manually in $ENV_FILE to your droplet's public IP/domain!"
    fi
else
    echo "ℹ️  APP_URL already set — skipping"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅  .env Patched!                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📋 Current RADIUS/Network settings:"
grep -E "^(RADIUS|WG_|SERVER_PUBLIC|DROPLET|APP_URL|MIKROTIK)" "$ENV_FILE" | sed 's/SECRET=.*/SECRET=***HIDDEN***/'
echo ""
echo "Next: Run the FreeRADIUS setup script:"
echo "  sudo bash backend/scripts/setup-freeradius.sh"
echo ""
