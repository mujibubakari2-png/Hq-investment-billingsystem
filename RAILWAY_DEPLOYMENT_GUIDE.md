# Railway Deployment Guide - Complete Setup

This guide provides step-by-step instructions for deploying the Kenge ISP platform on Railway with proper database configuration and backend-frontend connection.

## Project Architecture

```
Frontend (Vite React)
    ↓ API calls to VITE_API_URL
Backend (Next.js + Prisma)
    ↓ DATABASE_URL
PostgreSQL Database
```

## Phase 1: Database Setup in Railway

### 1.1 Add PostgreSQL Plugin

1. Go to your Railway project dashboard
2. Click **"+ New"** button
3. Select **"Database"** → **"PostgreSQL"**
4. Wait for the database to initialize
5. Note the generated `DATABASE_URL` - it will be available in the Postgres service variables

### 1.2 Verify Database Connection String

The `DATABASE_URL` should follow this format:
```
postgresql://user:password@host:port/database
```

**Example:**
```
postgresql://postgres:randompassword@containers-us-west-XX.railway.app:5432/railway
```

You can find this in:
- Railway Dashboard → Postgres Service → Variables tab → Copy `DATABASE_URL`

## Phase 2: Backend Service Configuration

### 2.1 Backend Service Setup

1. Connect your GitHub repository to Railway
2. Create or configure the **backend** service
3. Set the root directory to `./backend` (important for monorepo)

### 2.2 Backend Environment Variables

In the Backend Service settings, set these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Copy from Postgres service |
| `NODE_ENV` | `production` | For production deployment |
| `JWT_SECRET` | Generate secure random | Use: `openssl rand -base64 32` |
| `CORS_ORIGIN` | `https://your-frontend-domain.railway.app` | Frontend origin for API requests |

**How to set environment variables:**
1. Backend Service → Settings → "Deploy" section
2. Click **"Add Variable"** button
3. Enter the variable name and value
4. Reference other services by clicking the **"Reference"** button

### 2.3 Backend Port Configuration

The backend should automatically use port **3000** (Next.js default). Railway will expose it with a unique domain.

**Note:** Next.js automatically reads the `PORT` environment variable if needed.

## Phase 3: Frontend Service Configuration

### 3.1 Frontend Service Setup

1. Create a new **frontend** service in Railway
2. Set the root directory to `./frontend` (for monorepo)
3. Set build command: `pnpm install && pnpm build`
4. Set start command: `pnpm run preview --host 0.0.0.0`

### 3.2 Frontend Environment Variables

In the Frontend Service settings, set:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | Reference Backend service | Format: `${{ services.backend.domain }}` |
| `NODE_ENV` | `production` | For production |

**To reference backend domain in Railway:**
1. Frontend Service → Variables
2. Click **"Add Variable"** 
3. For `VITE_API_URL` value, click **"Reference"** button
4. Select `services.backend.domain`

This creates: `https://backend-XXXX.railway.app`

### 3.3 Frontend Port Configuration

Frontend should run on port **5175** or **3000** (Vite default preview port).

## Phase 4: Verify Deployment

### 4.1 Check Backend Logs

1. Backend Service → Deployments
2. Click the latest deployment
3. View logs to confirm:
   ```
   ✅ Basic connection successful
   📋 Found X tables
   📊 SaaS plans count
   👥 Users count
   🎉 Database connection test completed successfully!
   ```

### 4.2 Check Database Connection

The backend deployment runs these checks automatically:
1. **Prisma Generate** - Generates Prisma client
2. **Migrations** - Runs `npx prisma migrate deploy`
3. **Seed** - Creates SaaS plans and super admin user
4. **Test** - Runs `node scripts/test-db.js`
5. **Start** - Runs `pnpm start`

### 4.3 Check Frontend Connection

1. Frontend Service → Deployments
2. View logs to confirm no build errors
3. Visit frontend domain
4. Open browser Developer Tools → Console
5. Make a test API call and verify it reaches the backend

**Test in browser console:**
```javascript
fetch(import.meta.env.VITE_API_URL + '/api/health')
  .then(r => r.json())
  .then(d => console.log('Backend response:', d))
  .catch(e => console.error('Connection failed:', e))
```

## Phase 5: Troubleshooting

### Issue: "Failed to fetch" in frontend

**Cause:** Frontend cannot reach backend API

**Solutions:**
1. Verify `VITE_API_URL` is set correctly in frontend service
2. Check if the URL matches the backend domain exactly
3. Verify backend service is running (check logs)
4. Check CORS settings in backend

**To verify CORS:**
- Backend has CORS middleware in `src/middleware/csrfProtection.ts`
- Ensure it allows requests from the frontend domain

### Issue: Empty database (no tables)

**Cause:** Migrations didn't run during deployment

**Solutions:**
1. Check backend deployment logs for migration errors
2. Verify `DATABASE_URL` is accessible during deploy phase
3. Check if Postgres service is properly attached
4. Manually run migrations:
   ```bash
   railway run npx prisma migrate deploy
   ```

### Issue: "Database connection test failed"

**Cause:** Backend cannot connect to Postgres

**Solutions:**
1. Verify `DATABASE_URL` format: `postgresql://user:password@host:port/db`
2. Check Postgres service is running
3. Verify the hostname is reachable from backend service
4. Check authentication credentials match Postgres service
5. Test locally first:
   ```bash
   cd backend
   DATABASE_URL="your_database_url" npm run db:test
   ```

### Issue: "Authentication failed"

**Cause:** Wrong credentials in DATABASE_URL

**Solutions:**
1. Copy `DATABASE_URL` directly from Postgres service variables
2. Don't modify the password or credentials manually
3. Check for special characters that might need URL encoding

### Issue: Backend service won't start

**Cause:** Build error with TypeScript

**Solutions:**
1. Check backend build logs for TypeScript errors
2. Ensure `test-db.js` exists (not `.ts`)
3. Verify `scripts/seed.ts` uses proper TypeScript syntax
4. Check Node.js version: should be >= 18.0.0

## Phase 6: Environment Variables Reference

### All Required Environment Variables

**Postgres Service:**
```
DATABASE_URL=postgresql://user:pass@host:port/db
```

**Backend Service:**
```
DATABASE_URL=<reference from Postgres>
NODE_ENV=production
JWT_SECRET=<random 32-byte string>
CORS_ORIGIN=<frontend domain>
```

**Frontend Service:**
```
VITE_API_URL=<reference from Backend service domain>
NODE_ENV=production
```

## Phase 7: Monitoring and Maintenance

### View Logs

1. Select service → Deployments tab
2. Click deployment → View logs
3. Search for errors: `ERROR`, `failed`, `exception`

### Database Backups

Railway automatically backs up your database. To restore:
1. Postgres Service → Settings
2. Look for backup/restore options

### Scale Resources

If experiencing slowdowns:
1. Service → Settings → "Compute"
2. Increase RAM or CPU as needed

## Phase 8: Deployment Checklist

- [ ] Postgres service created and DATABASE_URL generated
- [ ] Backend service has DATABASE_URL variable set
- [ ] Backend service root directory is `./backend`
- [ ] Backend deployment logs show successful migration
- [ ] Backend deployment logs show successful seed
- [ ] Backend deployment logs show successful test-db
- [ ] Frontend service has VITE_API_URL set (reference to backend domain)
- [ ] Frontend service root directory is `./frontend`
- [ ] Frontend build completes successfully
- [ ] Frontend can make API calls to backend (test in console)
- [ ] Database tables are created (check logs)
- [ ] Super admin user is created
- [ ] SaaS plans are seeded

## Quick Deploy Commands

If using Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway up

# Deploy frontend
cd frontend
railway up

# View logs
railway logs --service backend
railway logs --service frontend
railway logs --service postgres
```

## Support

For issues:
1. Check [Railway Documentation](https://docs.railway.app)
2. Review deployment logs in Railway dashboard
3. Test database locally with: `DATABASE_URL=your_url npm run db:test`
4. Verify environment variables are set correctly
