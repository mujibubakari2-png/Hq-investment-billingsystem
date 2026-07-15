#!/bin/bash
# =============================================================================
# vps-setup.sh — Fresh Ubuntu VPS Initial Setup Script
# HQ Investment Billing System
#
# Run this ONCE on a brand-new Ubuntu 22.04 / 24.04 VPS as root:
#   ssh root@YOUR_VPS_IP
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/repo/main/vps-setup.sh | bash
#
# What it does:
#   1. Updates system packages
#   2. Creates deploy user with sudo
#   3. Installs Node.js 20, pnpm, PM2
#   4. Installs Nginx
#   5. Configures UFW firewall
#   6. Installs Fail2ban
#   7. Creates project folder structure
#   8. Generates DH params for SSL
#   9. Installs Docker CE + starts Redis via docker-compose.prod.yml
#  10. Installs systemd hq-docker.service (auto-starts Redis on reboot)
# =============================================================================

set -euo pipefail

# ── Config — edit before running ─────────────────────────────────────────────
DEPLOY_USER="ubuntu"
PROJECT_DIR="/var/www/Hq-investment-billingsystem"
NODE_VERSION="20"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo ""; echo "▶ $1"; }
ok()   { echo "  ✅ $1"; }

log "1/8 — Updating system packages"
apt update && apt upgrade -y
apt install -y curl wget git unzip ufw fail2ban htop nano build-essential ca-certificates gnupg lsb-release
ok "System updated"

# ── 2. Create deploy user ─────────────────────────────────────────────────────
log "2/8 — Creating deploy user: $DEPLOY_USER"
if id "$DEPLOY_USER" &>/dev/null; then
    echo "  ℹ️  User $DEPLOY_USER already exists — skipping"
else
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    # Copy root SSH keys to new user so you can SSH in immediately
    if [ -d /root/.ssh ]; then
        rsync --archive --chown="$DEPLOY_USER:$DEPLOY_USER" /root/.ssh "/home/$DEPLOY_USER/"
    fi
    ok "User $DEPLOY_USER created with sudo and SSH access"
fi

# ── 3. Allow passwordless sudo for deploy user (nginx + docker services) ─────
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx, /bin/systemctl start docker, /bin/systemctl start hq-docker.service, /bin/systemctl stop hq-docker.service" \
    > /etc/sudoers.d/hq-deploy
chmod 440 /etc/sudoers.d/hq-deploy
ok "Passwordless sudo configured for $DEPLOY_USER (nginx + hq-docker.service)"

# ── 4. Node.js + pnpm + PM2 ──────────────────────────────────────────────────
log "3/8 — Installing Node.js $NODE_VERSION LTS"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
apt install -y nodejs
ok "Node.js $(node --version) installed"

log "Installing pnpm"
npm install -g pnpm
ok "pnpm $(pnpm --version) installed"

log "Installing PM2 and pm2-logrotate"
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
ok "PM2 $(pm2 --version) installed"

# ── 5. Nginx ──────────────────────────────────────────────────────────────────
log "4/8 — Installing Nginx"
apt install -y nginx
systemctl enable nginx
systemctl start nginx
ok "Nginx $(nginx -v 2>&1 | grep -o '[0-9.]*') installed and started"

# Remove default site
rm -f /etc/nginx/sites-enabled/default
ok "Default Nginx site removed"

# Create shared snippets directory
mkdir -p /etc/nginx/snippets
ok "Nginx snippets directory ready"

# ── 6. UFW Firewall ───────────────────────────────────────────────────────────
log "5/8 — Configuring UFW firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     comment 'SSH'
ufw allow 80/tcp     comment 'HTTP'
ufw allow 443/tcp    comment 'HTTPS'
ufw deny  3000/tcp   comment 'Block direct backend access'
ufw deny  3001/tcp   comment 'Block direct landing-page access'
# Enable non-interactively
echo "y" | ufw enable
ok "UFW firewall enabled"
ufw status verbose

# ── 7. Fail2ban ───────────────────────────────────────────────────────────────
log "6/8 — Configuring Fail2ban"
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Append HQ Investment jail config
cat >> /etc/fail2ban/jail.local << 'EOF'

# ── HQ Investment custom settings ────────────────────────────────────────────
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s
maxretry = 3

[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable fail2ban
systemctl restart fail2ban
ok "Fail2ban started"

# ── 8. Project folder structure ───────────────────────────────────────────────
log "7/8 — Creating project folder structure"
mkdir -p "$PROJECT_DIR"/{backend,frontend/dist,landing-page/public,logs}
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"
ok "Project directory created: $PROJECT_DIR"

# Certbot challenge directory
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot
ok "Certbot challenge directory created"

# ── 9. DH params for SSL ─────────────────────────────────────────────────────
log "8/8 — Generating DH parameters (2048-bit) — this takes ~1 minute"
if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
    mkdir -p /etc/letsencrypt
    openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
    ok "DH params generated"
else
    ok "DH params already exist — skipping"
fi

# ── 9. Docker CE ─────────────────────────────────────────────────────────────
log "9/10 — Installing Docker CE"
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    # Allow deploy user to run docker without sudo
    usermod -aG docker "$DEPLOY_USER"
    ok "Docker CE installed and started"
else
    ok "Docker CE already installed — skipping"
fi

# ── 10. Systemd service — keeps Redis+Postgres up on reboot ──────────────────
log "10/10 — Installing hq-docker systemd service"
cat > /etc/systemd/system/hq-docker.service << EOF
[Unit]
Description=HQ Investment — Docker services (Redis + PostgreSQL)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file backend/.env up -d redis postgres
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml stop redis postgres
TimeoutStartSec=60

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable hq-docker.service
ok "hq-docker.service installed — Redis + PostgreSQL will auto-start on boot"

# ── PM2 startup ───────────────────────────────────────────────────────────────
log "Configuring PM2 to start on system boot"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" | tail -1 | bash
ok "PM2 startup configured"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VPS setup complete!"
echo ""
echo "Next steps:"
echo "  1. Upload your nginx configs to /etc/nginx/sites-available/"
echo "  2. Upload snippets to /etc/nginx/snippets/"
echo "  3. Enable sites: sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/"
echo "  4. Get SSL:  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d app.yourdomain.com -d api.yourdomain.com"
echo "  5. Clone your repo to $PROJECT_DIR"
echo "  6. Copy your .env files to backend/.env, frontend/.env, landing-page/.env"
echo "  7. Run: sudo systemctl start hq-docker   (starts Redis + PostgreSQL)"
echo "  8. Run: cd $PROJECT_DIR && pnpm install && pm2 start ecosystem.config.js && pm2 save"
echo "  9. Run: ./deploy.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
