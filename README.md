# HQ INVESTMENT — ISP Billing System

A **multi-tenant ISP billing platform** with MikroTik/RADIUS integration, multiple payment gateways, and a full admin dashboard.

---

## Architecture

```
monorepo (pnpm workspaces)
├── backend/        Next.js 15 API (port 3000) — REST API + Prisma + PostgreSQL
├── frontend/       Vite + React 19 SPA (port 5175 dev) — Admin Dashboard
└── landing-page/   Next.js — Marketing site (port 3001)

Production: DigitalOcean Droplet → Nginx → PM2
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 22.12.0 |
| pnpm | >= 9.0.0 |
| PostgreSQL | >= 14 |

## Quick Start (Development)

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# 3. Run database migrations
pnpm --filter backend prisma migrate dev

# 4. Seed the database (optional)
pnpm --filter backend db:seed

# 5. Start all services
pnpm dev
```

Frontend → http://localhost:5175  
Backend API → http://localhost:3000/api  
Landing page → http://localhost:3001

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | 64-char hex string for JWT signing |
| `FIELD_ENCRYPTION_KEY` | ✅ | 64-char hex string for router/payment credential encryption |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your app URL (https://yourdomain.com) |
| `CORS_ORIGIN` | ✅ | Frontend URL for CORS |
| `GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth (for Google login) |
| `AT_API_KEY` | ⚠️ | Africa's Talking SMS API key |

Generate secrets:
```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Field encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Production Deployment

### 1. Set up SSL (required)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d app.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com
```

### 2. Deploy
```bash
# Install dependencies
corepack enable
pnpm install --frozen-lockfile

# Run DB migrations
pnpm --filter backend exec prisma migrate deploy

# Build apps
pnpm --filter backend build
pnpm --filter landing-page build
pnpm --filter frontend build

# Nginx serves frontend/dist directly at /billing/
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo cp nginx-sites/yourdomain.com /etc/nginx/sites-available/yourdomain.com
sudo cp nginx-sites/app.yourdomain.com /etc/nginx/sites-available/app.yourdomain.com
sudo cp nginx-sites/api.yourdomain.com /etc/nginx/sites-available/api.yourdomain.com

sudo ln -sf /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/yourdomain.com
sudo ln -sf /etc/nginx/sites-available/app.yourdomain.com /etc/nginx/sites-enabled/app.yourdomain.com
sudo ln -sf /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/api.yourdomain.com

sudo nginx -t
sudo systemctl reload nginx

# Start/restart with PM2
pm2 start ecosystem.config.js --env production --update-env
pm2 save
```

Production Nginx should use these three vhost files:

```text
/etc/nginx/sites-available/yourdomain.com
/etc/nginx/sites-available/app.yourdomain.com
/etc/nginx/sites-available/api.yourdomain.com
```

Keep `nginx.conf` only at `/etc/nginx/nginx.conf`; do not copy it into
`/etc/nginx/sites-enabled/`, or Nginx will fail with `"user" directive is not
allowed here`.

### 3. CI/CD (GitHub Actions)
Push to `main` → automatically builds and deploys via SSH.

Add these secrets to GitHub → Settings → Secrets:
- `DROPLET_HOST` — your server IP
- `DROPLET_USER` — SSH user (e.g. `root`)
- `DROPLET_SSH_KEY` — private SSH key content

## API Documentation

The backend exposes a Swagger UI at:
```
http://localhost:3000/api/docs
```

## Security

- **Credentials**: Never commit `.env` — all secrets go in environment variables
- **Router passwords**: Encrypted at rest with AES-256-GCM (`FIELD_ENCRYPTION_KEY`)
- **Payment API keys**: Encrypted at rest with AES-256-GCM
- **JWT**: 30-minute access tokens (use refresh tokens for session continuity)
- **Rate limiting**: DB-backed, survives restarts
- **HTTPS**: Required in production — see SSL setup above

## Project Structure

```
backend/src/
├── app/api/        Next.js API route handlers
├── lib/            Shared utilities (auth, prisma, logger, encryption, mikrotik)
├── middleware/     CSRF, rate limiting, auth
└── prisma/         Schema + migrations

frontend/src/
├── api/            Domain API modules (authApi, clientsApi, networkApi, …)
├── components/     Reusable UI components
├── pages/          Route-level page components (lazy-loaded)
└── stores/         Zustand state stores
```
