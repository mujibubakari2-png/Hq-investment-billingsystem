# Railway Deployment - Complete Verification Checklist

## Current Status

✅ **Build System:** Fixed - Backend builds successfully
✅ **Test Script:** Converted to JavaScript (test-db.js)
✅ **Database Tests:** Script created and integrated
✅ **Deployment Configuration:** railway.toml updated with proper commands
✅ **Frontend Setup:** VITE_API_URL environment variable ready
✅ **Health Check:** API endpoint configured

## What You Need to Do in Railway Dashboard

### Step 1: Database Setup (PostgreSQL Service)

- [ ] 1. In Railway dashboard, click **"+ New"** button
- [ ] 2. Select **"Database"** → **"PostgreSQL"**
- [ ] 3. Wait for database initialization (2-3 minutes)
- [ ] 4. Once ready, go to the Postgres service → **Variables** tab
- [ ] 5. Copy the `DATABASE_URL` value - it should look like:
  ```
  postgresql://postgres:PASSWORD@containers-us-west-XX.railway.app:5432/railway
  ```
- [ ] 6. Keep this URL safe - you'll need it for the backend service

### Step 2: Backend Service Configuration

In your Railway project, configure or create the **backend** service:

#### Environment Variables

- [ ] 1. Go to Backend Service → **Variables** or **Settings**
- [ ] 2. Add/Update the following variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Paste the PostgreSQL DATABASE_URL |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Generate with: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CORS_ORIGIN` | `https://<frontend-domain>.railway.app` |
| `GOOGLE_CLIENT_ID` | `96960694156-pg7m1cjdqas9nelo83nicrq4ig3kuq3l.apps.googleusercontent.com` |

#### Build & Start Configuration

- [ ] 1. Service root directory: `./backend` (for monorepo)
- [ ] 2. Build command: `pnpm install && pnpm build` (should auto-detect)
- [ ] 3. Start command: Should auto-detect from package.json

#### Verify Deployment

After pushing or triggering a new deployment:

- [ ] 1. Go to **Deployments** tab
- [ ] 2. Click the latest deployment
- [ ] 3. View logs and look for success indicators:
  ```
  ✅ Basic connection successful
  ✅ Database connection test completed successfully!
  ```
- [ ] 4. If you see errors about DATABASE_URL, go back to step 2 and verify it's set correctly
- [ ] 5. Wait until status shows "Success" or you see "listening on port 3000"

### Step 3: Frontend Service Configuration

In your Railway project, configure or create the **frontend** service:

#### Environment Variables

- [ ] 1. Go to Frontend Service → **Variables**
- [ ] 2. Add `VITE_API_URL` variable
- [ ] 3. For the value, click the **Reference** button
- [ ] 4. Select: `${{ services.backend.domain }}`
  - This automatically uses your backend domain without the protocol

#### Build & Start Configuration

- [ ] 1. Service root directory: `./frontend` (for monorepo)
- [ ] 2. Build command: `pnpm install && pnpm build` (should auto-detect)
- [ ] 3. Start command: `pnpm run preview --host 0.0.0.0`

#### Verify Deployment

- [ ] 1. Go to **Deployments** tab
- [ ] 2. Click the latest deployment
- [ ] 3. View logs - should see no build errors
- [ ] 4. Once deployment succeeds, click the **Public URL** link
- [ ] 5. Open the browser's Developer Console (F12 → Console tab)
- [ ] 6. Run this test command:
  ```javascript
  fetch(import.meta.env.VITE_API_URL + '/api/health')
    .then(r => r.json())
    .then(d => console.log('✅ Backend response:', d))
    .catch(e => console.error('❌ Backend error:', e))
  ```
- [ ] 7. You should see: `✅ Backend response: {status: "ok", ...}`

### Step 4: Verify Database Connection

#### Test Backend Database Connection

- [ ] 1. Go to Backend Service → **Deployments**
- [ ] 2. Click the latest deployment
- [ ] 3. Scroll through logs and verify these appear:
  ```
  [DB-TEST] Testing database connection...
  ✅ Basic connection successful
  📋 Found X tables
  📊 SaaS plans count
  👥 Users count
  🎉 Database connection test completed successfully!
  ```

#### Test Database Tables

- [ ] 1. If logs show database connection failed, check:
  - DATABASE_URL is correctly set (no typos)
  - Postgres service is running and attached
  - PASSWORD in DATABASE_URL doesn't have special characters that need encoding

#### Test Super Admin Creation

- [ ] 1. If logs show "✅ SaaS plans count: 3", database is working
- [ ] 2. The super admin user should be created with:
  - Email: `superadmin@hqinvestment.co.tz`
  - Password: `hq-admin-2026`
  - Role: SUPER_ADMIN

## Troubleshooting Guide

### Problem: Backend deployment fails with "exit code: 1"

**Possible Causes:**
1. DATABASE_URL not set or incorrect
2. TypeScript compilation error
3. Missing environment variables

**Solution:**
1. Check Backend Service logs for the specific error
2. Verify DATABASE_URL is set in variables
3. Ensure no typos in environment variable names

### Problem: "Database connection test failed" in logs

**Possible Causes:**
1. DATABASE_URL format is wrong
2. Postgres service not attached
3. Credentials are incorrect

**Solution:**
1. Verify DATABASE_URL format: `postgresql://user:password@host:port/db`
2. Copy DATABASE_URL directly from Postgres service (don't edit it)
3. Check that the host is accessible (containers-us-west-XX.railway.app)

### Problem: Frontend shows "Failed to fetch" errors

**Possible Causes:**
1. VITE_API_URL is not set in frontend service
2. Backend service domain is incorrect
3. Backend is not running

**Solution:**
1. Verify VITE_API_URL is set in Frontend Service → Variables
2. Verify it references the correct backend service
3. Check backend service is deployed and running
4. Test with: `console.log(import.meta.env.VITE_API_URL)` in browser console

### Problem: "Connection timeout" or "ECONNREFUSED"

**Possible Causes:**
1. Postgres service not running
2. Network connectivity issue
3. Connection pool misconfigured

**Solution:**
1. Verify Postgres service status in Railway dashboard
2. Check that backend can see the Postgres service (they should be in same project)
3. Check logs for connection pool errors

## Database Schema Verification

Once deployment is successful, the database should have these tables:

```
users, user_otps, clients, packages, subscriptions, invoices,
transactions, equipment, routers, payment_channels, mobile_transactions,
sms_templates, vouchers, expenses, saas_plans, tenants, ...
```

You can verify this by:
1. Checking backend logs for: "📋 Found X tables"
2. Or using a PostgreSQL client to connect to the Railway database

## Environment Variables Summary

### Postgres Service
```
DATABASE_URL = postgresql://postgres:XXX@containers-us-west-XX.railway.app:5432/railway
```

### Backend Service
```
DATABASE_URL = <copy from postgres>
NODE_ENV = production
JWT_SECRET = <generate random 32-byte string>
CORS_ORIGIN = <your frontend domain>
GOOGLE_CLIENT_ID = 96960694156-pg7m1cjdqas9nelo83nicrq4ig3kuq3l.apps.googleusercontent.com
```

### Frontend Service
```
VITE_API_URL = ${{ services.backend.domain }}
NODE_ENV = production
```

## Manual Testing Commands (if using Railway CLI)

```bash
# Test backend connection
railway run --service backend npx prisma db execute --stdin < /path/to/test.sql

# View backend logs
railway logs --service backend --tail 100

# View frontend logs
railway logs --service frontend --tail 100

# View database logs
railway logs --service postgres --tail 100

# Test database directly (if you have psql installed)
psql "postgresql://user:pass@host:port/db"
```

## Next Steps After Successful Deployment

1. **Test user registration and login** - Create a new user account
2. **Test API endpoints** - Verify all backend routes work
3. **Test database operations** - Create clients, packages, etc.
4. **Set up monitoring** - Monitor Railway dashboard for errors
5. **Configure custom domain** - If you have a custom domain, configure it in Railway

## Important Notes

- **DATABASE_URL is only available during deploy phase** - The test-db.js script runs during deployment to verify the connection
- **After deployment, the backend connects to the database normally** - The seed script creates initial data
- **Frontend domain will be different from backend domain** - They're separate services, so set VITE_API_URL to reference the backend service
- **Railway generates random domains** - You can assign custom domains later in Settings

## Quick Reference

| Service | Purpose | Root Dir | Env Variables |
|---------|---------|----------|---|
| Postgres | Database | N/A | DATABASE_URL (exported) |
| Backend | Next.js API | ./backend | DATABASE_URL, NODE_ENV, JWT_SECRET |
| Frontend | Vite React | ./frontend | VITE_API_URL (reference backend domain) |

