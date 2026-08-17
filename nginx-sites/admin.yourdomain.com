# =============================================================================
# /etc/nginx/sites-available/admin.yourdomain.com
# Platform Super Admin Dashboard - Vite static build served by Nginx
#
# Deploy:
#   sudo cp nginx-sites/admin.yourdomain.com /etc/nginx/sites-available/admin.yourdomain.com
#   sudo ln -s /etc/nginx/sites-available/admin.yourdomain.com /etc/nginx/sites-enabled/
#   sudo certbot --nginx -d admin.yourdomain.com
#   sudo nginx -t && sudo systemctl reload nginx
# =============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name admin.yourdomain.com;

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
    server_name admin.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "DENY" always;
    add_header X-Content-Type-Options     "nosniff" always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy         "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy
        "default-src 'self'; \
         script-src 'self' 'unsafe-inline'; \
         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \
         font-src 'self' https://fonts.gstatic.com; \
         img-src 'self' data: https:; \
         connect-src 'self' https://api.yourdomain.com; \
         frame-ancestors 'none';" always;

    limit_req  zone=general burst=50 nodelay;
    limit_conn addr 30;

    root /var/www/Hq-investment-billingsystem/super-admin/dist;
    index index.html;

    # API proxy to backend
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

    # Static assets with aggressive caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        access_log off;
    }

    # SPA fallback: any URL not matching an actual file goes to index.html
    # This allows React Router to handle all client-side routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    access_log /var/log/nginx/admin.yourdomain.com.access.log;
    error_log  /var/log/nginx/admin.yourdomain.com.error.log;
}
