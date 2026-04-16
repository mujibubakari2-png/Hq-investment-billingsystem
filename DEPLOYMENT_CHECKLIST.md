# Railway Deployment Checklist ✅

## Phase 1: Preparation
- [ ] Review project structure (backend/frontend/landing-page)
- [ ] Ensure all dependencies are in package.json files
- [ ] Check Prisma schema is correct (no url in datasource)
- [ ] Generate JWT_SECRET: `openssl rand -hex 32`
- [ ] Get Google OAuth credentials (optional)

## Phase 2: Railway Account Setup
- [ ] Go to https://railway.app
- [ ] Sign up/login with GitHub
- [ ] Create new project: "Kenge ISP Billing"
- [ ] **Enable Auto-Deploy**: Connect to GitHub repository

## Phase 3: Deploy Backend Service
- [ ] Click "New Project" → "Deploy from GitHub"
- [ ] Select repository: `mujibubakari2-png/Hq-investment-billingsystem`
- [ ] Railway auto-detects services and deploys them
- [ ] **Auto-deploy enabled**: Every push to master triggers deployment
- [ ] Add PostgreSQL plugin:
  - [ ] Railway dashboard → Add → Database → PostgreSQL
  - [ ] Plugin auto-generates DATABASE_URL
- [ ] Set environment variables in Railway dashboard:
  - [ ] `DATABASE_URL` (auto-generated)
  - [ ] `JWT_SECRET` (your generated secret)
  - [ ] `NODE_ENV=production`
  - [ ] `GOOGLE_CLIENT_ID` (if using Google auth)
  - [ ] `CORS_ORIGIN` (set after frontend deploys)
- [ ] Railway automatically redeploys with new env vars

## Phase 4: Deploy Frontend Service
- [ ] Railway auto-created frontend service from GitHub
- [ ] Set environment variables in Railway dashboard:
  - [ ] `VITE_API_URL=https://[backend-service-url]`
  - [ ] `VITE_GOOGLE_CLIENT_ID` (same as backend)
- [ ] Copy frontend service URL for CORS setting

## Phase 5: Update Backend CORS
- [ ] Go back to backend service in Railway
- [ ] Update `CORS_ORIGIN` with frontend URL
- [ ] Railway auto-redeploys backend

## Phase 6: Deploy Landing Page Service
- [ ] Railway auto-created landing-page service
- [ ] No environment variables needed
- [ ] Deploys automatically

## Phase 7: Database Setup
- [ ] Run migrations: `railway run npx prisma migrate deploy`
- [ ] Seed database: `railway run npx prisma db seed`
- [ ] Verify database connection

## Phase 8: Verify Auto-Deploy
- [ ] Make a small change (add comment to README)
- [ ] Push to GitHub master branch
- [ ] Watch Railway dashboard - should auto-deploy
- [ ] Check all services are healthy

## Phase 9: Testing
- [ ] Test backend health endpoint
- [ ] Test frontend loads and connects to backend
- [ ] Test landing page loads
- [ ] Test user authentication (if applicable)
- [ ] Test database operations

## Phase 10: Custom Domain (Optional)
- [ ] Go to each service settings in Railway
- [ ] Add custom domain
- [ ] Update DNS records
- [ ] Update CORS_ORIGIN with custom domain

## Phase 11: GitHub Actions (Optional Advanced Setup)
If you want more control, set up GitHub Actions:
- [ ] Go to GitHub repository → Settings → Secrets
- [ ] Add `RAILWAY_TOKEN` secret (get from Railway Account → Tokens)
- [ ] Add `RAILWAY_PROJECT_ID` secret (from Railway project settings)
- [ ] GitHub Actions will auto-deploy on every push
- [ ] Includes automatic database migrations

---

## Environment Variables Summary

### Backend
```
DATABASE_URL=postgresql://[auto-generated]
JWT_SECRET=[64-char-random-string]
NODE_ENV=production
GOOGLE_CLIENT_ID=[your-oauth-id]
CORS_ORIGIN=https://[frontend-url]
```

### Frontend
```
VITE_API_URL=https://[backend-url]
VITE_GOOGLE_CLIENT_ID=[same-as-backend]
```

### Landing Page
```
(none required)
```

---

## Useful Commands

```bash
# Check service status
railway status

# View logs
railway logs

# Run commands in deployed environment
railway run npx prisma migrate deploy
railway run npx prisma db seed

# Set environment variables
railway variables set KEY=value
```

---

## Troubleshooting Checklist

- [ ] Build logs show no errors
- [ ] All environment variables are set
- [ ] DATABASE_URL is correct
- [ ] CORS_ORIGIN matches frontend URL
- [ ] VITE_API_URL points to backend
- [ ] Database migrations ran successfully
- [ ] All services are healthy

---

## Rollback Plan

If issues occur:
1. Check Railway deployment logs
2. Verify environment variables
3. Test locally first
4. Redeploy individual services if needed
5. Contact Railway support if persistent issues

---

## Success Criteria ✅

- [ ] All 3 services deployed successfully
- [ ] Auto-deploy working (push triggers deployment)
- [ ] Backend API responding
- [ ] Frontend loads and connects to backend
- [ ] Landing page accessible
- [ ] Database connected and seeded
- [ ] No console errors in browser
- [ ] Authentication working (if enabled)

---

**Need help?** Refer to `AUTO_DEPLOYMENT.md` and `RAILWAY_DEPLOYMENT.md` for detailed instructions.