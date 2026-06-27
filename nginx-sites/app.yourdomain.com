# =============================================================================
# /etc/nginx/sites-available/app.yourdomain.com
# Billing SPA - Vite static build served by Nginx at /billing/
#
# Deploy:
#   sudo cp nginx-sites/app.yourdomain.com /etc/nginx/sites-available/app.yourdomain.com
#   sudo ln -s /etc/nginx/sites-available/app.yourdomain.com /etc/nginx/sites-enabled/
#   sudo certbot --nginx -d app.yourdomain.com
#   sudo nginx -t && sudo systemctl reload nginx
# =============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name app.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 308 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "SAMEORIGIN" always;
    add_header X-Content-Type-Options     "nosniff" always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy         "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy
        "default-src 'self'; \
         script-src 'self' 'unsafe-inline' https://accounts.google.com; \
         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \
         font-src 'self' https://fonts.gstatic.com; \
         img-src 'self' data: https:; \
         connect-src 'self' https://api.yourdomain.com; \
         frame-src https://accounts.google.com;" always;

    limit_req  zone=general burst=50 nodelay;
    limit_conn addr 30;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location = / {
        return 302 /billing/;
    }

    location = /billing {
        return 301 /billing/;
    }

    location /billing/assets/ {
        alias /var/www/Hq-investment-billingsystem/frontend/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        access_log off;
    }

    location /billing/ {
        alias /var/www/Hq-investment-billingsystem/frontend/dist/;
        try_files $uri $uri/ /billing/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    access_log /var/log/nginx/app.yourdomain.com.access.log;
    error_log  /var/log/nginx/app.yourdomain.com.error.log;
}
