# Post-Deployment Database Setup Guide

After the backend service successfully deploys on Railway, follow these steps to set up the database:

## Step 1: Connect to Railway Backend

```bash
railway connect postgres
```

This will open a psql connection to your PostgreSQL database on Railway.

## Step 2: Apply Database Schema

```bash
cd backend
npx prisma db push
```

This applies the Prisma schema migrations to your Railway PostgreSQL database.

## Step 3: Seed the Database

```bash
npx prisma db seed
```

This populates the database with initial data:
- SaaS plans (Basic, Standard, Premium)
- Super admin user (username: `admin`, password: `admin123`)
- Sample agent and viewer users
- Sample system settings

## Step 4: Verify Database Setup

You can verify the database is set up by:

1. **Via Railway CLI:**
   ```bash
   railway connect postgres
   \dt  # List all tables
   SELECT COUNT(*) FROM "User";  # Check user count
   ```

2. **Via Railway Dashboard:**
   - Go to your PostgreSQL service
   - Click "Connect" → "Web Interface"
   - Use the web browser console to query data

## Alternative: Use Railway SSH

If the above doesn't work, you can SSH into the backend service:

```bash
railway ssh -s backend
```

Then run:
```bash
cd /app/backend
npx prisma db push
npx prisma db seed
```

## Troubleshooting

### "Cannot find module '@prisma/adapter-pg'"
- Make sure dependencies are installed: `pnpm install`
- Run from the backend directory: `cd backend`

### "Connection refused to database"
- Verify DATABASE_URL is set correctly in Railway Backend Variables
- Check that PostgreSQL service is running in Railway

### "Seed script failed"
- Check backend logs: `railway logs -s backend`
- Verify the seed.ts file has correct Prisma schema imports
- Ensure database credentials have proper permissions

## Environment Variables Required

Make sure these are set in Railway Backend Service:
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Set to `production`
- `JWT_SECRET` - Secret for JWT tokens
- `CORS_ORIGIN` - Frontend service URL

---

**Note:** The build process was simplified to only compile the application. Database setup is now a separate post-deployment step to avoid build failures. This is a common pattern for cloud deployments where data operations should be isolated from the build process.
