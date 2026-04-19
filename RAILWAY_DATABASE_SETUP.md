# Railway Database Connection Setup Guide

## Quick Summary
For Railway to work with your database, you need to:
1. ✅ Attach PostgreSQL database to Railway project (plugin)
2. ✅ Set environment variables in backend service
3. ✅ Redeploy backend service
4. ✅ Database will auto-migrate and seed

---

## Step 1: Attach PostgreSQL Database to Railway

### In Railway Dashboard:
1. Go to your **Railway Project**
2. Click **"+ Add"** button → **PostgreSQL**
3. Railway creates a new PostgreSQL database
4. The `DATABASE_URL` is **automatically set** as an environment variable

**Important**: Do NOT manually set `DATABASE_URL` - let Railway do it!

---

## Step 2: Set Backend Environment Variables

### In Railway Dashboard → Backend Service → Variables

Add these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | *Auto-set by PostgreSQL plugin* | ⚠️ Do NOT set manually |
| `NODE_ENV` | `production` | Required for Railway |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | **IMPORTANT**: Generate a new one! |
| `CORS_ORIGIN` | `https://hq-frontend.up.railway.app` | Your frontend URL |
| `GOOGLE_CLIENT_ID` | `96960694156-pg7m1cjdqas9nelo83nicrq4ig3kuq3l.apps.googleusercontent.com` | From Google Cloud |

### Copy-Paste Ready Values:
```
NODE_ENV=production
CORS_ORIGIN=https://hq-frontend.up.railway.app
GOOGLE_CLIENT_ID=96960694156-pg7m1cjdqas9nelo83nicrq4ig3kuq3l.apps.googleusercontent.com
```

**For JWT_SECRET**, generate a new random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3: Verify Database Connection Settings

The backend is configured to:
1. **Read** `DATABASE_URL` from environment
2. **Create a connection pool** with:
   - Max 5 connections
   - 30 second idle timeout
   - 10 second connection timeout
   - 30 second statement timeout
3. **Run migrations** automatically on deploy
4. **Seed database** with SaaS plans and Super Admin

---

## Step 4: Redeploy Backend Service

1. Make sure latest code is pushed to GitHub
2. Go to Railway Dashboard → Backend Service
3. Click **"Redeploy"** (or wait for auto-deploy if connected)
4. Watch the deployment logs

### Expected Log Output:
```
[DATABASE] Connecting to: postgresql://***@containers-us-west-xxx.railway.app:***

[SEED] Testing database connection...
✅ Database connection successful (XXXms)

📋 Seeding SaaS Plans...
✅ SaaS Plans created.

👤 Creating Super Admin user...
✅ Created new Super Admin: superadmin@hqinvestment.co.tz

[DB-TEST] Testing database connection...
✅ Basic connection successful
📋 Found 29 tables
📊 SaaS plans count: 3
👥 Users count: 1
🎉 Database connection test completed successfully!
```

📋 Seeding SaaS Plans...
✅ SaaS Plans created.

👤 Creating Super Admin user...
✅ Updated existing Super Admin: superadmin@hqinvestment.co.tz

🎉 Database seed completed successfully!
```

---

## Step 5: Test Database Connection

### Option 1: Check Backend Logs
1. Go to Railway Dashboard → Backend Service → **Logs**
2. Look for the messages above to confirm connection

### Option 2: Test API Health Endpoint
```bash
curl https://hq-backend.up.railway.app/api/health
```

### Option 3: SSH Into Backend Service (Advanced)
```bash
# In Railway, open terminal for backend service
psql $DATABASE_URL

# In PostgreSQL prompt:
\dt                  # List all tables
SELECT COUNT(*) FROM users;           # Check users
SELECT COUNT(*) FROM "saasPlan";      # Check plans
```

---

## Troubleshooting Database Connection Issues

### Issue 1: "DATABASE_URL is not set" Error

**Problem**: Backend crashes on startup with DATABASE_URL error

**Solution**:
1. Go to Railway Dashboard → PostgreSQL Service
2. Check the database is running (green status)
3. Go to Backend Service → Variables
4. Make sure `DATABASE_URL` is shown (should be auto-set)
5. If missing, click "Connect" on PostgreSQL service to auto-set it
6. Redeploy backend

### Issue 2: "Connection Refused" or "Connection Timeout"

**Problem**: Backend can't reach the database

**Solution**:
1. Make sure PostgreSQL is **attached** to the same project
2. Check DATABASE_URL format is valid:
   ```
   postgresql://username:password@host:port/database
   ```
3. In Railway, services communicate via internal network
4. Check PostgreSQL service logs for errors
5. Redeploy both services in correct order: **PostgreSQL → Backend → Frontend**

### Issue 3: "Migrations Failed"

**Problem**: Tables not created

**Solution**:
1. Check backend logs for specific error message
2. Most common: DATABASE_URL not set or wrong
3. Verify Prisma schema file exists: `backend/prisma/schema.prisma`
4. Check migration files exist: `backend/prisma/migrations/`
5. Redeploy backend service

### Issue 4: "Super Admin Not Created"

**Problem**: Can't login with superadmin credentials

**Solution**:
1. Check seed script ran (look for "Database seed completed")
2. SSH into backend and verify users table:
   ```
   psql $DATABASE_URL
   SELECT * FROM users LIMIT 1;
   ```
3. If no users, manually run seed:
   ```
   npx tsx scripts/seed.ts
   ```

### Issue 5: Frontend Can't Connect to Backend

**Problem**: "Failure to Fetch" error

**Solution**:
1. Check `CORS_ORIGIN` is set to frontend URL
2. Verify frontend `VITE_API_URL` is set correctly
3. Check both services are running (green status)
4. Test API directly: `curl https://hq-backend.up.railway.app/api/health`

---

## Environment Variable Checklist

Before deploying, verify all these are set:

**Backend Service Variables:**
- [ ] `DATABASE_URL` - Auto-set by PostgreSQL plugin
- [ ] `NODE_ENV` = `production`
- [ ] `JWT_SECRET` - Random 32+ char string
- [ ] `CORS_ORIGIN` = `https://hq-frontend.up.railway.app`
- [ ] `GOOGLE_CLIENT_ID` = Your OAuth client ID

**Frontend Service Variables:**
- [ ] `VITE_API_URL` = `https://hq-backend.up.railway.app`

**PostgreSQL Service:**
- [ ] Database is running and attached to project
- [ ] `DATABASE_URL` is visible in backend service variables

---

## Database Connection Architecture

```
┌─────────────────────────────────────────────────┐
│           Railway Platform                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────┐    ┌─────────────────┐   │
│  │  Backend Service │    │ PostgreSQL DB   │   │
│  │  (Node.js)       │───▶│  (Connection    │   │
│  │                  │    │   Pool)         │   │
│  └──────────────────┘    └─────────────────┘   │
│         │                                       │
│         │ startCommand:                         │
│         │ npx prisma migrate deploy             │
│         │ npx tsx scripts/seed.ts               │
│         │ pnpm start                            │
│         ▼                                       │
│  Listening on port 3000 (mapped to public)    │
│                                                 │
└─────────────────────────────────────────────────┘

Connection Flow:
1. Backend starts
2. Reads DATABASE_URL from environment
3. Creates connection pool to PostgreSQL
4. Runs migrations (creates tables)
5. Runs seed script (creates initial data)
6. Starts listening for API requests
```

---

## Local Testing Before Railway Deployment

Test the database connection locally first:

```bash
# 1. Make sure .env has correct DATABASE_URL
cat backend/.env

# 2. Test migrations
cd backend
npx prisma migrate status

# 3. Test seed script
npx tsx scripts/seed.ts

# 4. Check data was created
npx prisma studio

# 5. Start backend
npm run dev
```

---

## Production Database Best Practices

1. **Never hardcode** DATABASE_URL
2. **Generate unique** JWT_SECRET for each environment
3. **Use environment variables** for all secrets
4. **Enable backups** for PostgreSQL service in Railway
5. **Monitor** database logs for errors
6. **Connection pooling** is enabled by default (max 5 connections)
7. **Timeout settings**: 
   - Connection timeout: 10 seconds
   - Statement timeout: 30 seconds
   - Idle timeout: 30 seconds

---

## Database Schema

Your database includes tables for:
- Users (with roles: SUPER_ADMIN, ADMIN, AGENT, VIEWER)
- Clients (ISP customers)
- Packages (internet plans)
- Subscriptions (active client plans)
- Transactions (payments)
- Routers (network equipment)
- Invoices, Vouchers, Equipment, SMS, etc.

**Super Admin Account (auto-created):**
- Email: `superadmin@hqinvestment.co.tz`
- Password: `hq-admin-2026`

---

## Getting Help

If you encounter issues:
1. Check Railway dashboard service logs
2. Review this guide's troubleshooting section
3. Verify all environment variables are set
4. Check PostgreSQL service is running
5. Redeploy services in order: PostgreSQL → Backend → Frontend
