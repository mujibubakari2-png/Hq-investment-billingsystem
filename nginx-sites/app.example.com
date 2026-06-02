# =============================================================================
# /etc/nginx/sites-available/app.yourdomain.com
# Billing SPA — Vite static build served by Nginx
#
# Deploy:
#   sudo cp nginx-sites/app.yourdomain.com /etc/nginx/sites-available/app.yourdomain.com
#   sudo ln -s /etc/nginx/sites-available/app.yourdomain.com /etc/nginx/sites-enabled/
#   sudo nginx -t && sudo systemctl reload nginx
# =============================================================================

# ── Redirect HTTP → HTTPS ─────────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name app.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS — Billing SPA ───────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.yourdomain.com;

    # SSL — managed by Certbot
    ssl_certificate     /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    root  /var/www/Hq-investment-billingsystem/frontend/dist;
    index index.html;

    # ── Security Headers ──────────────────────────────────────────────────────
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "SAMEORIGIN"                          always;
    add_header X-Content-Type-Options     "nosniff"                             always;
    add_header X-XSS-Protection           "1; mode=block"                       always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin"     always;
    add_header Permissions-Policy         "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy
        "default-src 'self'; \
         script-src 'self' 'unsafe-inline' https://accounts.google.com; \
         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \
         font-src 'self' https://fonts.gstatic.com; \
         img-src 'self' data: https:; \
         connect-src 'self' https://api.yourdomain.com; \
         frame-src https://accounts.google.com;" always;

    # ── Rate limiting ─────────────────────────────────────────────────────────
    limit_req  zone=general burst=50 nodelay;
    limit_conn addr 30;

    # ── Hashed static assets (Vite fingerprints filenames) ───────────────────
    # Cache forever — if content changes, filename hash changes too.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        access_log off;
    }

    # ── Fonts and icons ───────────────────────────────────────────────────────
    location ~* \.(woff|woff2|ttf|eot|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── SPA shell — never cache so new deploys load immediately ──────────────
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    # ── Logs ──────────────────────────────────────────────────────────────────
    access_log /var/log/nginx/app.yourdomain.com.access.log;
    error_log  /var/log/nginx/app.yourdomain.com.error.log;
}
