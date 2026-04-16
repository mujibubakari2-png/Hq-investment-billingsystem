# Railway Deployment Checklist

## Phase 1: Remove from Render ✅

- [ ] Go to https://render.com dashboard
- [ ] Navigate to "Services"
- [ ] Delete `kenge-backend` service
- [ ] Delete any frontend/landing-page services from Render
- [ ] Confirm services are deleted (no more charges)

---

## Phase 2: Setup Railway Account

- [ ] Go to https://railway.app
- [ ] Sign up or login with GitHub
- [ ] Create a new project called "kenge"

---

## Phase 3: Prepare Environment Variables

Generate/gather these values:

### Backend Variables (from your existing .env or services)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - Generate: `openssl rand -hex 32` (save this!)
- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- [ ] `SMTP_HOST` - Email service host
- [ ] `SMTP_PORT` - Email service port
- [ ] `SMTP_USER` - Email service username
- [ ] `SMTP_PASSWORD` - Email service password
- [ ] `SMTP_FROM` - From email address
- [ ] `NODE_ENV` - Set to `production`
- [ ] Any other custom environment variables

### Frontend Variables
- [ ] `VITE_API_URL` - Will be your Railway backend URL (get after backend deploys)
- [ ] `VITE_GOOGLE_CLIENT_ID` - Same as backend Google Client ID

---

## Phase 4: Deploy Backend Service

1. [ ] In Railway dashboard, click "New Project"
2. [ ] Select "Deploy from GitHub"
3. [ ] Connect to your GitHub account
4. [ ] Select your `kenge` repository
5. [ ] Railway should auto-detect and create a service
6. [ ] **Important**: Set root directory to `backend/` (if not auto-detected)
7. [ ] Click "Deploy"
8. [ ] Once deployed, go to service settings
9. [ ] Click "Environment" tab
10. [ ] Add all backend environment variables listed above
11. [ ] Add a PostgreSQL plugin:
    - [ ] In Railway dashboard, click "Add plugin"
    - [ ] Select "PostgreSQL"
    - [ ] It will auto-generate `DATABASE_URL`
    - [ ] Make sure this URL is visible in backend environment
12. [ ] Wait for redeploy to complete
13. [ ] Copy the backend service URL (Railway will assign one automatically)
14. [ ] Run database migrations:
    - [ ] Go to backend service → Logs
    - [ ] Or use Railway CLI: `railway run npx prisma migrate deploy`

---

## Phase 5: Deploy Frontend Service

1. [ ] In Railway dashboard, click "New service"
2. [ ] Create from same GitHub repo
3. [ ] Set root directory to `frontend/`
4. [ ] Click "Deploy"
5. [ ] Go to service settings
6. [ ] In "Environment" tab, add:
   - [ ] `VITE_API_URL` = (your Railway backend URL from Phase 4)
   - [ ] `VITE_GOOGLE_CLIENT_ID` = (same as backend)
7. [ ] Wait for deployment

---

## Phase 6: Deploy Landing Page Service

1. [ ] In Railway dashboard, click "New service"
2. [ ] Create from same GitHub repo
3. [ ] Set root directory to `landing-page/`
4. [ ] Click "Deploy"
5. [ ] Go to service settings
6. [ ] Add any required environment variables

---

## Phase 7: Verify Deployments

- [ ] Backend is running (check logs)
- [ ] Frontend loads without errors
- [ ] Landing page is accessible
- [ ] Frontend can communicate with backend
- [ ] Database is connected and initialized

---

## Phase 8: Configure Domains (Optional)

- [ ] Go to each service in Railway
- [ ] Under "Settings" → "Domain"
- [ ] Use Railway-assigned domain OR connect custom domain
- [ ] Update your application code if needed

---

## Phase 9: Update Render References

Search and replace in your code:

- [ ] Find: `kenge-backend.onrender.com`
- [ ] Replace with: Your Railway backend URL
- [ ] Search entire codebase for "onrender"
- [ ] Replace all references

---

## Post-Deployment

- [ ] Test all API endpoints
- [ ] Test user authentication
- [ ] Test email sending
- [ ] Check error logs
- [ ] Monitor resource usage in Railway dashboard
- [ ] Set up alerts if available

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check service logs, ensure all deps in package.json |
| Backend won't start | Check DATABASE_URL and environment variables |
| Frontend can't reach backend | Check VITE_API_URL and CORS configuration |
| Database connection error | Verify DATABASE_URL format, restart service |
| Port conflicts | Check Dockerfile EXPOSE ports |

---

## Rollback Plan

If needed to go back to Render:
1. Recreate services on Render
2. Set same environment variables
3. Redeploy from GitHub

---

## Useful Railway Commands (if using CLI)

```bash
# Login to Railway
railway login

# Create new project
railway init

# Deploy a service
railway up --name service-name

# Check logs
railway logs

# View environment variables
railway variables

# Set environment variable
railway variables set KEY=value
```

## File Checklist

Ensure these files exist in your repo:
- [ ] `backend/Dockerfile` ✓ Created
- [ ] `frontend/Dockerfile` ✓ Created
- [ ] `frontend/nginx.conf` ✓ Created
- [ ] `landing-page/Dockerfile` ✓ Created
- [ ] `package.json` in each service ✓ Exists
- [ ] `.env.example` in backend ✓ (for reference)

---

**Need help?** See `RAILWAY_DEPLOYMENT_GUIDE.md` for detailed information.
