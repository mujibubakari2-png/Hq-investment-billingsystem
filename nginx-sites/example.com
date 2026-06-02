# =============================================================================
# /etc/nginx/sites-available/yourdomain.com
# Landing Page — Static files served directly by Nginx
#
# Deploy:
#   sudo cp nginx-sites/yourdomain.com /etc/nginx/sites-available/yourdomain.com
#   sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
#   sudo nginx -t && sudo systemctl reload nginx
# =============================================================================

# ── Redirect bare HTTP → HTTPS ────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # ACME challenge for Certbot (must be before the redirect)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS — Landing Page ──────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL — managed by Certbot (run: sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com)
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    root  /var/www/Hq-investment-billingsystem/landing-page/public;
    index index.html;

    # ── Security Headers ──────────────────────────────────────────────────────
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "SAMEORIGIN"                          always;
    add_header X-Content-Type-Options     "nosniff"                             always;
    add_header X-XSS-Protection           "1; mode=block"                       always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin"     always;
    add_header Permissions-Policy         "geolocation=(), microphone=(), camera=()" always;

    # ── Rate limiting ─────────────────────────────────────────────────────────
    limit_req  zone=general burst=50 nodelay;
    limit_conn addr 30;

    # ── Hashed/versioned static assets — long-term cache ─────────────────────
    location ~* \.(css|js|woff|woff2|ttf|eot|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Images — moderate cache ───────────────────────────────────────────────
    location ~* \.(jpg|jpeg|png|gif|ico|webp|avif)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        access_log off;
    }

    # ── HTML — no cache (always fresh on deploy) ──────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, must-revalidate";
        expires 0;
    }

    # ── Logs ──────────────────────────────────────────────────────────────────
    access_log /var/log/nginx/yourdomain.com.access.log;
    error_log  /var/log/nginx/yourdomain.com.error.log;
}
