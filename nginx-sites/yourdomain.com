# =============================================================================
# /etc/nginx/sites-available/yourdomain.com
# Landing page - Next.js app reverse-proxied to PM2 on 127.0.0.1:3001
#
# Deploy:
#   sudo cp nginx-sites/yourdomain.com /etc/nginx/sites-available/yourdomain.com
#   sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
#   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
#   sudo nginx -t && sudo systemctl reload nginx
# =============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

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
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "SAMEORIGIN" always;
    add_header X-Content-Type-Options     "nosniff" always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy         "geolocation=(), microphone=(), camera=()" always;

    limit_req  zone=general burst=50 nodelay;
    limit_conn addr 30;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_cache_bypass                 $http_upgrade;
        proxy_read_timeout                 120s;
        proxy_send_timeout                 120s;
    }

    access_log /var/log/nginx/yourdomain.com.access.log;
    error_log  /var/log/nginx/yourdomain.com.error.log;
}
