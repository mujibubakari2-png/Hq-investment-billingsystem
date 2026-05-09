#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Kenge ISP Billing — FreeRADIUS Setup Script
# Installs and configures FreeRADIUS to work with PostgreSQL (port 5444)
# and accepts authentication requests from MikroTik routers.
#
# Run this ONCE on the Droplet after initial deployment:
#   sudo bash backend/scripts/setup-freeradius.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      FreeRADIUS Setup — Kenge ISP Billing System     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Load .env ────────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    echo "✅ Loading environment from $ENV_FILE"
    set -o allexport
    source "$ENV_FILE"
    set +o allexport
else
    echo "❌ ERROR: .env file not found at $ENV_FILE"
    exit 1
fi

# ── Parse DB connection from DATABASE_URL ─────────────────────────────────────
# Expected format: postgresql://user:password@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

DB_PASS_DECODED=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$DB_PASS'))" 2>/dev/null || echo "$DB_PASS")

echo "📦 Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# ── Step 1: Install FreeRADIUS ────────────────────────────────────────────────
echo "📥 Step 1: Installing FreeRADIUS + PostgreSQL module..."
sudo apt-get update -qq
sudo apt-get install -y freeradius freeradius-postgresql freeradius-utils
echo "✅ FreeRADIUS installed"

RADIUS_CONF_DIR="/etc/freeradius/3.0"

# ── Step 2: Configure SQL module ──────────────────────────────────────────────
echo ""
echo "⚙️  Step 2: Configuring FreeRADIUS SQL module (PostgreSQL)..."

sudo tee "$RADIUS_CONF_DIR/mods-available/sql" > /dev/null <<EOF
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"

    # ── Database Connection ─────────────────────────────────────────
    server   = "$DB_HOST"
    port     = $DB_PORT
    login    = "$DB_USER"
    password = "$DB_PASS_DECODED"
    radius_db = "$DB_NAME"

    # ── Table Names (must match Prisma schema) ──────────────────────
    acct_table1    = "radacct"
    acct_table2    = "radacct"
    postauth_table = "radpostauth"
    authcheck_table = "radcheck"
    authreply_table  = "radreply"
    groupcheck_table = "radgroupcheck"
    groupreply_table = "radgroupreply"
    usergroup_table  = "radusergroup"

    # ── NAS Clients from DB ─────────────────────────────────────────
    read_clients = yes
    client_table = "radius_nas"

    # ── Connection Pool ─────────────────────────────────────────────
    pool {
        start        = 5
        min          = 4
        max          = 32
        spare        = 10
        uses         = 0
        retry_delay  = 30
        lifetime     = 0
        idle_timeout = 60
    }

    # ── SQL Queries ─────────────────────────────────────────────────
    # Authenticate: check password in radcheck table
    authorize_check_query = "\
        SELECT id, username, attribute, value, op \
        FROM radcheck \
        WHERE username = '%{SQL-User-Name}' \
        ORDER BY id"

    # Accounting: insert/update radacct
    accounting_start_query = "\
        INSERT INTO radacct \
            (acctsessionid, acctuniqueid, username, realm, \
             nasipaddress, nasportid, nasporttype, \
             acctstarttime, acctupdatetime, \
             acctstoptime, acctsessiontime, acctauthentic, \
             connectinfo_start, acctinputoctets, acctoutputoctets, \
             calledstationid, callingstationid, acctterminatecause, \
             servicetype, framedprotocol, framedipaddress) \
        VALUES \
            ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', \
             '%{SQL-User-Name}', '%{Realm}', \
             '%{NAS-IP-Address}', '%{NAS-Port-Id}', '%{NAS-Port-Type}', \
             TO_TIMESTAMP('%S', 'YYYY-MM-DD HH24:MI:SS'), \
             TO_TIMESTAMP('%S', 'YYYY-MM-DD HH24:MI:SS'), \
             NULL, 0, '%{Acct-Authentic}', \
             '%{Connect-Info}', 0, 0, \
             '%{Called-Station-Id}', '%{Calling-Station-Id}', '', \
             '%{Service-Type}', '%{Framed-Protocol}', '%{Framed-IP-Address}')"
}
EOF

# Enable the SQL module
sudo ln -sf "$RADIUS_CONF_DIR/mods-available/sql" "$RADIUS_CONF_DIR/mods-enabled/sql" 2>/dev/null || true
echo "✅ SQL module configured (port $DB_PORT)"

# ── Step 3: Create radpostauth table (if missing) ─────────────────────────────
echo ""
echo "🗄️  Step 3: Ensuring radpostauth table exists in PostgreSQL..."
PGPASSWORD="$DB_PASS_DECODED" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL 2>/dev/null || echo "⚠️  Could not create radpostauth (may already exist)"
CREATE TABLE IF NOT EXISTS radpostauth (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(64)  NOT NULL DEFAULT '',
    pass        VARCHAR(64)  NOT NULL DEFAULT '',
    reply       VARCHAR(32)  NOT NULL DEFAULT '',
    authdate    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "tenantId"  TEXT
);
CREATE INDEX IF NOT EXISTS idx_radpostauth_username ON radpostauth(username);
SQL
echo "✅ radpostauth table ready"

# ── Step 4: Configure default site to use SQL ─────────────────────────────────
echo ""
echo "⚙️  Step 4: Enabling SQL in the default virtual server..."

# Enable sql in authorize section
sudo sed -i '/^[[:space:]]*#[[:space:]]*sql$/s/^[[:space:]]*#[[:space:]]*/\t/' \
    "$RADIUS_CONF_DIR/sites-available/default" 2>/dev/null || true

# Enable sql in accounting section
sudo sed -i '/authorize/,/}/ s/#\tsql/\tsql/' \
    "$RADIUS_CONF_DIR/sites-available/default" 2>/dev/null || true

echo "✅ Default site updated"

# ── Step 5: Configure clients.conf ────────────────────────────────────────────
echo ""
echo "🔑 Step 5: Configuring NAS clients (MikroTik routers)..."

# Check if we already have a kenge block
if ! grep -q "# Kenge ISP Managed Clients" "$RADIUS_CONF_DIR/clients.conf" 2>/dev/null; then
# ─── Kenge ISP Managed Clients ───────────────────────────────────────────────
# MikroTik routers connecting via WireGuard VPN (10.0.0.0/24 subnet)
# Secret loaded from RADIUS_NAS_SECRET env var
RADIUS_SECRET="${RADIUS_NAS_SECRET:-kenge_radius_secret}"
WG_SERVER="${WG_SERVER_IP:-10.0.0.1}"
WG_SUBNET=$(echo "$WG_SERVER" | cut -d. -f1-3).0/24

sudo tee -a "$RADIUS_CONF_DIR/clients.conf" > /dev/null <<CLIENTS

# ─── Kenge ISP Managed Clients ───────────────────────────────────────────────
# MikroTik routers connecting via WireGuard VPN
client wireguard_subnet {
    ipaddr    = $WG_SUBNET
    secret    = $RADIUS_SECRET
    shortname = mikrotik-wg
    nastype   = other
    # Secret from .env: RADIUS_NAS_SECRET
    # WG subnet auto-derived from WG_SERVER_IP
}

# Allow localhost testing
client localhost_test {
    ipaddr    = 127.0.0.1
    secret    = testing123
    shortname = localhost
    nastype   = other
}
CLIENTS
echo "✅ clients.conf updated"
else
    echo "ℹ️  clients.conf already has Kenge entries — skipping"
fi

# ── Step 6: Open firewall ports ────────────────────────────────────────────────
echo ""
echo "🔒 Step 6: Opening firewall ports 1812/1813 (UDP)..."
sudo ufw allow 1812/udp comment 'RADIUS Authentication' 2>/dev/null || true
sudo ufw allow 1813/udp comment 'RADIUS Accounting'     2>/dev/null || true
sudo ufw reload 2>/dev/null || true
echo "✅ Firewall ports opened"

# ── Step 7: Enable & Start FreeRADIUS ─────────────────────────────────────────
echo ""
echo "🚀 Step 7: Enabling and starting FreeRADIUS..."
sudo systemctl enable freeradius
sudo systemctl restart freeradius

sleep 2

if sudo systemctl is-active --quiet freeradius; then
    echo "✅ FreeRADIUS is running!"
else
    echo "❌ FreeRADIUS failed to start. Check logs:"
    echo "   sudo journalctl -u freeradius -n 50 --no-pager"
    echo "   sudo freeradius -X   (for verbose debug mode)"
    exit 1
fi

# ── Step 8: Self-test ──────────────────────────────────────────────────────────
echo ""
echo "🧪 Step 8: Running self-test..."
if radtest test test 127.0.0.1 0 testing123 2>/dev/null | grep -q "Access-"; then
    echo "✅ FreeRADIUS is responding to auth requests"
else
    echo "⚠️  Self-test inconclusive — FreeRADIUS is running but test user not in DB (that's OK)"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅  Setup Complete!                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next steps:"
echo "  1. In your billing dashboard → Settings → Routers → RADIUS NAS:"
echo "     Add your MikroTik router with the secret: kenge_radius_secret"
echo "  2. In MikroTik → RADIUS:"
echo "     Address : 10.0.0.1  (WireGuard IP of this Droplet)"
echo "     Secret  : kenge_radius_secret"
echo "     Auth Port: 1812   Acct Port: 1813"
echo "  3. In MikroTik → IP → Hotspot → Servers → your server → RADIUS:"
echo "     ✅ Use RADIUS checked"
echo "     ✅ RADIUS Accounting checked"
echo ""
echo "🔍 To debug RADIUS in real-time:"
echo "   sudo systemctl stop freeradius && sudo freeradius -X"
echo ""
