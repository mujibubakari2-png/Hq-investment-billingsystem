#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# HQInvestment ISP Billing — FreeRADIUS Setup Script
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
echo "║    FreeRADIUS Setup — HQInvestment ISP Billing       ║"
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

# ── Step 2: Create missing RADIUS tables in PostgreSQL ────────────────────────
echo ""
echo "🗄️  Step 2: Ensuring all RADIUS tables exist in PostgreSQL..."

PGPASSWORD="$DB_PASS_DECODED" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
-- radreply: reply attributes sent back on Access-Accept (Session-Timeout, Rate-Limit)
CREATE TABLE IF NOT EXISTS radreply (
    id        SERIAL        PRIMARY KEY,
    username  VARCHAR(64)   NOT NULL DEFAULT '',
    attribute VARCHAR(64)   NOT NULL,
    op        VARCHAR(2)    NOT NULL DEFAULT '=',
    value     VARCHAR(253)  NOT NULL,
    "tenantId" TEXT
);
CREATE INDEX IF NOT EXISTS idx_radreply_username   ON radreply(username);
CREATE INDEX IF NOT EXISTS idx_radreply_tenantid   ON radreply("tenantId");
CREATE INDEX IF NOT EXISTS idx_radreply_tenant_usr ON radreply("tenantId", username);

-- radpostauth: authentication attempt log
CREATE TABLE IF NOT EXISTS radpostauth (
    id        BIGSERIAL     PRIMARY KEY,
    username  VARCHAR(64)   NOT NULL DEFAULT '',
    pass      VARCHAR(64)   NOT NULL DEFAULT '',
    reply     VARCHAR(32)   NOT NULL DEFAULT '',
    authdate  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "tenantId" TEXT
);
CREATE INDEX IF NOT EXISTS idx_radpostauth_username ON radpostauth(username);
CREATE INDEX IF NOT EXISTS idx_radpostauth_tenantid ON radpostauth("tenantId");

-- radgroupcheck: group-level check attributes
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id        SERIAL       PRIMARY KEY,
    groupname VARCHAR(64)  NOT NULL DEFAULT '',
    attribute VARCHAR(64)  NOT NULL,
    op        VARCHAR(2)   NOT NULL DEFAULT ':=',
    value     VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radgroupcheck_groupname ON radgroupcheck(groupname);

-- radgroupreply: group-level reply attributes
CREATE TABLE IF NOT EXISTS radgroupreply (
    id        SERIAL       PRIMARY KEY,
    groupname VARCHAR(64)  NOT NULL DEFAULT '',
    attribute VARCHAR(64)  NOT NULL,
    op        VARCHAR(2)   NOT NULL DEFAULT '=',
    value     VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radgroupreply_groupname ON radgroupreply(groupname);

-- radusergroup: maps users to groups
CREATE TABLE IF NOT EXISTS radusergroup (
    id        SERIAL      PRIMARY KEY,
    username  VARCHAR(64) NOT NULL DEFAULT '',
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    priority  INT         NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_radusergroup_username ON radusergroup(username);
SQL
echo "✅ RADIUS tables ready"

# ── Step 3: Configure SQL module ──────────────────────────────────────────────
echo ""
echo "⚙️  Step 3: Configuring FreeRADIUS SQL module (PostgreSQL)..."

# IMPORTANT: PostgreSQL column names created by Prisma with camelCase use
# quoted identifiers (e.g. "tenantId", "nasName"). The SQL queries below
# use these quoted names to match the actual DB schema.
sudo tee "$RADIUS_CONF_DIR/mods-available/sql" > /dev/null <<EOF
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"

    # Set SQL user name
    sql_user_name = "%{User-Name}"

    # ── Database Connection ─────────────────────────────────────────
    server   = "$DB_HOST"
    port     = $DB_PORT
    login    = "$DB_USER"
    password = "$DB_PASS_DECODED"
    radius_db = "$DB_NAME"

    # ── Table Names (must match Prisma @@map names) ─────────────────
    acct_table1      = "radacct"
    acct_table2      = "radacct"
    postauth_table   = "radpostauth"
    authcheck_table  = "radcheck"
    authreply_table  = "radreply"
    groupcheck_table = "radgroupcheck"
    groupreply_table = "radgroupreply"
    usergroup_table  = "radusergroup"

    # ── NAS Clients: read from static clients.conf (not DB)
    # We do NOT use read_clients=yes because Prisma uses camelCase
    # column names ("nasName") which FreeRADIUS SQL cannot handle.
    # NAS clients are registered in clients.conf (Step 5).
    read_clients = no

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

    # ── authorize_check_query ───────────────────────────────────────
    # Fetch all check attributes for this username.
    # NOTE: "tenantId" is quoted because Prisma creates it as camelCase.
    authorize_check_query = "\
        SELECT id, username, attribute, value, op \
        FROM radcheck \
        WHERE username = '%{SQL-User-Name}' \
        ORDER BY id"

    # ── authorize_reply_query ───────────────────────────────────────
    # Fetch reply attributes (Session-Timeout, Rate-Limit, etc.)
    authorize_reply_query = "\
        SELECT id, username, attribute, value, op \
        FROM radreply \
        WHERE username = '%{SQL-User-Name}' \
        ORDER BY id"

    # ── authorize_group_check_query ─────────────────────────────────
    authorize_group_check_query = "\
        SELECT id, groupname, attribute, value, op \
        FROM radgroupcheck \
        WHERE groupname = '%{SQL-Group}' \
        ORDER BY id"

    # ── authorize_group_reply_query ─────────────────────────────────
    authorize_group_reply_query = "\
        SELECT id, groupname, attribute, value, op \
        FROM radgroupreply \
        WHERE groupname = '%{SQL-Group}' \
        ORDER BY id"

    # ── group_membership_query ──────────────────────────────────────
    group_membership_query = "\
        SELECT groupname \
        FROM radusergroup \
        WHERE username = '%{SQL-User-Name}' \
        ORDER BY priority ASC"

    # ── Accounting: INSERT on Start ─────────────────────────────────
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

    # ── Accounting: UPDATE on Interim-Update ───────────────────────
    accounting_update_query = "\
        UPDATE radacct \
        SET \
            acctupdatetime  = TO_TIMESTAMP('%S', 'YYYY-MM-DD HH24:MI:SS'), \
            acctsessiontime = '%{Acct-Session-Time}', \
            acctinputoctets  = '%{Acct-Input-Octets}', \
            acctoutputoctets = '%{Acct-Output-Octets}' \
        WHERE acctsessionid  = '%{Acct-Session-Id}' \
          AND nasipaddress    = '%{NAS-IP-Address}'"

    # ── Accounting: UPDATE on Stop ──────────────────────────────────
    accounting_stop_query = "\
        UPDATE radacct \
        SET \
            acctstoptime       = TO_TIMESTAMP('%S', 'YYYY-MM-DD HH24:MI:SS'), \
            acctsessiontime    = '%{Acct-Session-Time}', \
            acctinputoctets    = '%{Acct-Input-Octets}', \
            acctoutputoctets   = '%{Acct-Output-Octets}', \
            acctterminatecause = '%{Acct-Terminate-Cause}', \
            connectinfo_stop   = '%{Connect-Info}' \
        WHERE acctsessionid = '%{Acct-Session-Id}' \
          AND nasipaddress  = '%{NAS-IP-Address}'"

    # ── Post-Auth logging ────────────────────────────────────────────
    postauth_query = "\
        INSERT INTO radpostauth (username, pass, reply, authdate) \
        VALUES (\
            '%{SQL-User-Name}', \
            '%{%{User-Password}:-%{Chap-Password}}', \
            '%{reply:Packet-Type}', \
            NOW())"
}
EOF

# Enable the SQL module
sudo ln -sf "$RADIUS_CONF_DIR/mods-available/sql" "$RADIUS_CONF_DIR/mods-enabled/sql" 2>/dev/null || true
echo "✅ SQL module configured (PostgreSQL port $DB_PORT)"

# ── Step 4: Configure the default virtual server to use SQL ──────────────────
echo ""
echo "⚙️  Step 4: Writing a clean default site configuration..."

sudo tee "$RADIUS_CONF_DIR/sites-available/default" > /dev/null <<'VSERVER'
server default {
    listen {
        type      = auth
        ipaddr    = *
        port      = 0
        limit {
            max_connections = 16
            lifetime        = 0
            idle_timeout    = 30
        }
    }

    listen {
        ipaddr = *
        port   = 0
        type   = acct
        limit {}
    }

    authorize {
        filter_username
        preprocess
        chap
        mschap
        eap { ok = return }
        expiration
        logintime

        # Pull user's check + reply attributes from PostgreSQL
        sql

        pap
    }

    authenticate {
        Auth-Type PAP  { pap  }
        Auth-Type CHAP { chap }
        Auth-Type MS-CHAP { mschap }
        eap
    }

    preacct {
        preprocess
        acct_unique
        suffix
        files
    }

    accounting {
        detail
        unix
        sql
        exec
        attr_filter.accounting_response
    }

    session {
        sql
    }

    post-auth {
        update {
            &reply: += &session-state:
        }
        sql
        exec
        remove_reply_message_if_eap
        Post-Auth-Type REJECT {
            sql
            attr_filter.access_reject
            eap
            remove_reply_message_if_eap
        }
    }

    pre-proxy {}
    post-proxy { eap }
}
VSERVER

sudo ln -sf "$RADIUS_CONF_DIR/sites-available/default" "$RADIUS_CONF_DIR/sites-enabled/default" 2>/dev/null || true
echo "✅ Default virtual server configured"

# ── Step 5: Configure clients.conf ────────────────────────────────────────────
echo ""
echo "🔑 Step 5: Configuring NAS clients (MikroTik routers)..."

RADIUS_SECRET="${RADIUS_NAS_SECRET:-hqinvestment_radius_secret}"
WG_SERVER="${WG_SERVER_IP:-10.0.0.1}"
WG_SUBNET=$(echo "$WG_SERVER" | cut -d. -f1-3).0/24
DROPLET_PUBLIC_IP="${DROPLET_IP:-}"

if ! grep -q "# HQInvestment ISP Managed Clients" "$RADIUS_CONF_DIR/clients.conf" 2>/dev/null; then

sudo tee -a "$RADIUS_CONF_DIR/clients.conf" > /dev/null <<CLIENTS

# ─── HQInvestment ISP Managed Clients ───────────────────────────────────────
# MikroTik routers connect via WireGuard VPN (10.0.0.0/24) using this secret.
# The same secret must be configured in MikroTik → RADIUS → Secret.

client wireguard_subnet {
    ipaddr    = $WG_SUBNET
    secret    = $RADIUS_SECRET
    shortname = mikrotik-wg
    nastype   = other
}

# Allow the WireGuard server IP directly as well
client wireguard_server {
    ipaddr    = $WG_SERVER
    secret    = $RADIUS_SECRET
    shortname = wg-server
    nastype   = other
}

CLIENTS

# If a public IP is set, also allow direct public IP access (fallback)
if [ -n "$DROPLET_PUBLIC_IP" ]; then
sudo tee -a "$RADIUS_CONF_DIR/clients.conf" > /dev/null <<PUBCLIENT

# Allow direct public IP access (fallback when WireGuard is not used)
client droplet_public {
    ipaddr    = $DROPLET_PUBLIC_IP
    secret    = $RADIUS_SECRET
    shortname = droplet-public
    nastype   = other
}
PUBCLIENT
fi

echo "✅ clients.conf updated (secret: $RADIUS_SECRET, subnet: $WG_SUBNET)"
else
    echo "ℹ️  clients.conf already has HQInvestment entries — skipping"
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
    echo "   sudo systemctl stop freeradius && sudo freeradius -X"
    exit 1
fi

# ── Step 8: Production verification ──────────────────────────────────────────
echo ""
echo "🔍 Step 8: Verifying FreeRADIUS service status..."
if sudo systemctl is-active --quiet freeradius; then
    echo "✅ FreeRADIUS service is active and running in production mode"
    echo "   Listening on UDP 1812 (auth) and 1813 (acct)"
else
    echo "❌ FreeRADIUS is not running. Check logs:"
    echo "   sudo journalctl -u freeradius -n 50 --no-pager"
    exit 1
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅  Setup Complete!                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next steps:"
echo "  1. In your billing dashboard → RADIUS → NAS Clients:"
echo "     Add your MikroTik router IP with secret: $RADIUS_SECRET"
echo ""
echo "  2. In MikroTik → RADIUS → Add:"
echo "     Service  : hotspot (and/or ppp)"
echo "     Address  : $WG_SERVER  (WireGuard IP of this Droplet)"
echo "     Secret   : $RADIUS_SECRET"
echo "     Auth Port: 1812   Acct Port: 1813"
echo "     Timeout  : 3000 ms  (or more if latency is high)"
echo ""
echo "  3. In MikroTik → IP → Hotspot → Servers → your server → RADIUS:"
echo "     ✅ Use RADIUS checked"
echo "     ✅ RADIUS Accounting checked"
echo ""
echo "  4. In MikroTik → PPP → Profiles → your profile → General:"
echo "     Use RADIUS: yes"
echo ""
echo "🔍 To debug RADIUS in real-time:"
echo "   sudo systemctl stop freeradius && sudo freeradius -X"
echo ""
echo "🔍 To verify NAS client is known to FreeRADIUS:"
echo "   radtest <username> <password> $WG_SERVER 0 $RADIUS_SECRET"
echo ""
