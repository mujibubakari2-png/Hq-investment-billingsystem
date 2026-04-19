# Railway Deployment Checklist

## Prerequisites
- Railway project created
- GitHub repository connected to Railway

## Step 1: Set Up PostgreSQL Database Plugin
1. Go to your Railway project
2. Click **"+ Add"** → **PostgreSQL**
3. Railway will create a new PostgreSQL database
4. The `DATABASE_URL` environment variable will be automatically set

## Step 2: Backend Service Configuration

### Environment Variables (Backend Service)
Set these in Railway dashboard → Backend Service → **Variables**:

```
DATABASE_URL             # Auto-set by PostgreSQL plugin
JWT_SECRET               # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NODE_ENV                 production
GOOGLE_CLIENT_ID         96960694156-pg7m1cjdqas9nelo83nicrq4ig3kuq3l.apps.googleusercontent.com
CORS_ORIGIN              https://hq-frontend.up.railway.app
```

### Deployment Process
1. Commit code to `main` branch
2. Railway will automatically:
   - Run: `pnpm install && pnpm build`
   - Run: `npx prisma migrate deploy` (creates tables)
   - Run: `npx tsx scripts/seed.ts` (seeds initial data)
   - Start: `pnpm start`

## Step 3: Frontend Service Configuration

### Environment Variables (Frontend Service)
Set these in Railway dashboard → Frontend Service → **Variables**:

```
VITE_API_URL             https://hq-backend.up.railway.app
```

### Deployment Process
1. Railway builds: `pnpm install --no-frozen-lockfile && pnpm build`
2. Railway starts: `pnpm start` (Vite preview server)

## Step 4: Landing Page Service Configuration

### Environment Variables (Landing Page Service)
No special environment variables needed. Just deploy the next.js app.

### Deployment Process
1. Railway builds: `pnpm install && pnpm build`
2. Railway starts: `pnpm start`

## Verification Steps

### Check Database Seeding
1. Go to Backend Service → **Logs**
2. Look for these messages:
   ```
   ✅ Database connection successful
   ✅ SaaS Plans created
   ✅ Created new Super Admin
   ```

### Access the Application
1. Frontend: `https://hq-frontend.up.railway.app`
2. Backend API: `https://hq-backend.up.railway.app/api`
3. Super Admin login:
   - Email: `superadmin@hqinvestment.co.tz`
   - Password: `hq-admin-2026`

### Test API Connection
```bash
curl https://hq-backend.up.railway.app/api/health
```

## Troubleshooting

### Database is Empty
1. Check `DATABASE_URL` is set in Railway
2. Check backend logs for migration errors
3. Redeploy the backend service

### "Failure to Fetch" Error
1. Check `CORS_ORIGIN` is set correctly
2. Check `VITE_API_URL` is set correctly
3. Check frontend/vite.config.ts includes `preview.allowedHosts`

### Super Admin Not Created
1. Check seed script logs in backend service
2. Verify database connection is working
3. Check user table exists with `SELECT COUNT(*) FROM users;`

## Environment Variable Reference

### Database
- **DATABASE_URL**: PostgreSQL connection string (auto-set by Railway)
- Format: `postgresql://user:pass@host:port/dbname`

### Security
- **JWT_SECRET**: Random 32-64 character string for JWT signing
- **CORS_ORIGIN**: Frontend URL for cross-origin requests

### Services
- **VITE_API_URL**: Backend API URL for frontend (production only)
- **NODE_ENV**: Set to `production` in Railway

### Authentication
- **GOOGLE_CLIENT_ID**: OAuth client ID from Google Cloud Console

## Deployment Commands

Useful commands for testing locally before deploying:

```bash
# Run migrations
npx prisma migrate deploy

# Seed database
npx tsx scripts/seed.ts

# Check migration status
npx prisma migrate status

# Reset database (⚠️ DELETES ALL DATA)
npx prisma migrate reset
```
