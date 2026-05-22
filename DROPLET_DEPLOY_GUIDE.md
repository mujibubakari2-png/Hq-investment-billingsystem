# DigitalOcean Droplet Deployment Guide

This guide explains how to deploy the HQInvestment ISP Billing System to a **DigitalOcean Droplet** (VPS). This gives you full control and is often cheaper than App Platform for large databases.

## Step 1: Create a Droplet
1. Go to DigitalOcean and create a new **Droplet**.
2. **OS**: Ubuntu 24.04 LTS (recommended).
3. **Plan**: At least 2GB RAM (Shared CPU is fine for start).
4. **Authentication**: SSH Key (highly recommended).

## Step 2: Initial Server Setup
Connect to your droplet via SSH:
```bash
ssh root@your_droplet_ip
```

Once inside, run the setup script I provided:
```bash
# Clone your repo first (you'll need to add your SSH key to GitHub/GitLab)
git clone <your-repo-url> hqinvestment
cd hqinvestment

# Run the setup script
chmod +x droplet-setup.sh
./droplet-setup.sh
```

**Note**: After running the script, log out and log back in to apply group changes.

## Step 3: Setup the Database
We use Docker to run PostgreSQL on the same droplet.
1. Edit `docker-compose.yml` and change the `POSTGRES_PASSWORD`.
2. Start the database:
```bash
docker compose up -d
```

## Step 4: Configure Environment Variables
Create a `.env` file in the `backend` directory:
```bash
cd backend
cp .env.example .env
nano .env
```
Set the `DATABASE_URL` to:
`postgresql://hqinvestment_user:your_password@localhost:5432/hqinvestment_isp`

Also set `JWT_SECRET` and `GOOGLE_CLIENT_ID`.

## Step 5: Build Applications
Go back to the root directory and install dependencies:
```bash
cd ..
pnpm install
pnpm build:all
```

## Step 6: Deploy Frontend Static Files
Copy the frontend build files to the Nginx web root:
```bash
cp -r frontend/dist/* /var/www/html/billing/
```

## Step 7: Start Backend and Landing Page
Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 8: Configure Nginx
Copy the provided Nginx config to the system:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/hqinvestment
sudo ln -s /etc/nginx/sites-available/hqinvestment /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 9: SSL (HTTPS)
Use Certbot to get a free SSL certificate:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting Build Failures (Exit 137 / OOM)

### Symptom
```
frontend build$ vite build
│ Killed
└─ Failed in 7m 42.8s
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  frontend@0.0.0 build: `vite build`
Exit status 137
```

**Exit 137 = Linux OOM killer terminated the process.** The Vite/Rollup build temporarily
needs more RAM than is available. Two fixes are applied automatically:

1. **Node heap cap** — `frontend/package.json` now runs vite with
   `--max-old-space-size=1536` so Node never allocates more than 1.5 GB.
2. **Swap file** — `droplet-setup.sh` creates a 2 GB swap file at `/swapfile`
   during initial setup.

### If the server is already running (quick fix)

SSH into the droplet and run the included fix script:
```bash
chmod +x fix-oom-build.sh
./fix-oom-build.sh
```
It will add swap (if missing) then re-run the frontend build automatically.

### Manual steps (if you prefer)
```bash
# Add 2 GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Rebuild only the frontend
pnpm --filter frontend build

# Deploy static files
cp -r frontend/dist/* /var/www/html/billing/
```



### If you see "❌ Migration failed — refusing to start to avoid schema drift"

1. **Verify Database is Running
```bash
docker compose ps
```
Make sure the hqinvestment-db container is running. If not, start it:
```bash
docker compose up -d
```

2. **Check DATABASE_URL
Verify your backend/.env has the correct DATABASE_URL:
```
DATABASE_URL="postgresql://hqinvestment_user:your_password@localhost:5432/hqinvestment_isp"
```

3. **Try Running Migrations Manually
```bash
cd backend
pnpm exec prisma migrate deploy
```

4. **Fix Schema Drift (Development Only!)
If you get schema drift errors and this is a non-production environment, you can force push the schema:
```bash
cd backend
pnpm exec prisma db push
```
⚠️ WARNING: This will drop data! Only use for fresh databases!

5. **Force Start Without Migrations (Temporary!)**
If you need to start the app temporarily to diagnose, set this in backend/.env:
```
SKIP_MIGRATIONS=true
```
Then restart PM2:
```bash
pm2 restart backend
```
⚠️ Remember to set this back to false once migrations are fixed!

## Summary of Ports
- **Backend**: 3000
- **Landing Page**: 3001
- **Frontend Dashboard**: Served statically by Nginx
- **Database**: 5432 (Internal to droplet)
