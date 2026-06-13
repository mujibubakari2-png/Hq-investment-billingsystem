# =============================================================================
# /etc/nginx/sites-available/api.yourdomain.com
# Backend API - reverse proxy to Next.js/PM2 on 127.0.0.1:3000
#
# Deploy:
#   sudo cp nginx-sites/api.yourdomain.com /etc/nginx/sites-available/api.yourdomain.com
#   sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
#   sudo certbot --nginx -d api.yourdomain.com
#   sudo nginx -t && sudo systemctl reload nginx
# =============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "DENY" always;
    add_header X-Content-Type-Options     "nosniff" always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin" always;
    # SEC-004 FIX: Content-Security-Policy — API only serves JSON; block all framing/scripts
    add_header Content-Security-Policy    "default-src 'none'; frame-ancestors 'none'" always;
    # SEC-004 FIX: Disable browser features not needed by API
    add_header Permissions-Policy         "geolocation=(), microphone=(), camera=(), payment=()" always;
    # Tracing: unique request ID propagated to backend logs
    add_header X-Request-ID               $request_id always;

    add_header Access-Control-Allow-Origin      "https://app.yourdomain.com" always;
    add_header Access-Control-Allow-Methods     "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
    add_header Access-Control-Allow-Headers     "Authorization, Content-Type, X-Requested-With, X-Request-ID" always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Access-Control-Max-Age           "86400" always;

    # SEC-004 FIX: Reduced from 50M — only the /api/upload route needs large bodies
    client_max_body_size    10M;
    client_body_buffer_size 128k;

    if ($http_next_action) {
        return 444;
    }

    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin      "https://app.yourdomain.com" always;
        add_header Access-Control-Allow-Methods     "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers     "Authorization, Content-Type, X-Requested-With" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Max-Age           "86400" always;
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }

    proxy_intercept_errors on;
    error_page 502 503 504 = @api_error;

    location ~ ^/api/auth/(login|register|forgot-password|reset-password) {
        limit_req zone=auth burst=5 nodelay;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout                 30s;
        proxy_connect_timeout              10s;
    }

    location /api/upload {
        limit_req zone=api burst=10 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout                 120s;
        proxy_connect_timeout              10s;
        proxy_request_buffering            off;
        proxy_buffering                    off;
    }

    location ~ ^/(ws|socket\.io) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "Upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout                 86400s;
        proxy_send_timeout                 86400s;
    }

    location /hotspot/ {
        proxy_pass http://127.0.0.1:3000/hotspot/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout                 30s;
        proxy_hide_header X-Frame-Options;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location /api/ {
        limit_req  zone=api burst=20 nodelay;
        limit_conn addr 20;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass                 $http_upgrade;
        proxy_read_timeout                 60s;
        proxy_connect_timeout              10s;
    }

    location @api_error {
        default_type application/json;
        return 503 '{"error":"Service temporarily unavailable. Please try again shortly.","status":503}';
    }

    access_log /var/log/nginx/api.yourdomain.com.access.log;
    error_log  /var/log/nginx/api.yourdomain.com.error.log;
}
