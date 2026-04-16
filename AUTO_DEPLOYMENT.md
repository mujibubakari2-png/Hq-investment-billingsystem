# Railway Auto-Deployment from GitHub

Railway has **built-in automatic deployment** when you connect your GitHub repository. Here's how to set it up:

## 🚀 Method 1: Railway Built-in Auto-Deploy (Recommended)

### Step 1: Connect GitHub Repository
1. Go to [railway.app](https://railway.app)
2. Create new project or go to existing project
3. Click "Connect GitHub" or "Deploy from GitHub"
4. Select your repository: `mujibubakari2-png/Hq-investment-billingsystem`
5. Railway will automatically deploy on every push to `master` branch

### Step 2: Configure Auto-Deploy Settings
1. In Railway dashboard, go to your project
2. Click on each service (backend, frontend, landing-page)
3. Go to "Settings" → "Deploy"
4. Ensure "Auto-deploy" is enabled
5. Set branch to `master` (or your main branch)

### Step 3: Environment Variables
Set environment variables in Railway dashboard (they persist across deployments):
- Backend: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, etc.
- Frontend: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`
- Landing Page: Usually none needed

## 🔄 Method 2: GitHub Actions (Alternative)

If you want more control or custom deployment logic, use GitHub Actions:

### Create `.github/workflows/deploy.yml`

```yaml
name: Deploy to Railway

on:
  push:
    branches: [ master, main ]
  pull_request:
    branches: [ master, main ]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'backend/') || github.event_name == 'push'
    steps:
      - name: Deploy Backend
        uses: railwayapp/railway-deploy-action@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

  deploy-frontend:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'frontend/') || github.event_name == 'push'
    steps:
      - name: Deploy Frontend
        uses: railwayapp/railway-deploy-action@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: frontend

  deploy-landing:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'landing-page/') || github.event_name == 'push'
    steps:
      - name: Deploy Landing Page
        uses: railwayapp/railway-deploy-action@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: landing-page
```

### Step 4: Set Up GitHub Secrets
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add new repository secret: `RAILWAY_TOKEN`
4. Get token from Railway: Account Settings → Tokens → Generate

## 🎯 Current Setup (Recommended)

Your project is already configured for Railway auto-deployment:

### ✅ What's Ready:
- Dockerfiles for all services
- Environment variable templates
- Deployment documentation
- GitHub repository connected

### 🚀 To Enable Auto-Deploy:

1. **Go to Railway Dashboard**
2. **Create new project** or use existing
3. **Click "Deploy from GitHub"**
4. **Select your repository**
5. **Railway will auto-detect services** and deploy them
6. **Add PostgreSQL plugin** to backend service
7. **Set environment variables** in Railway dashboard

### 🔄 Auto-Deploy Behavior:
- **Every push to master** → Automatic deployment
- **New commits** → Services rebuild and redeploy
- **Environment variables** → Persist across deployments
- **Database** → Stays intact (only schema changes need migration)

## 📊 Deployment Flow:

```
GitHub Push → Railway Detects → Build Docker → Deploy → Health Check → Live
```

## 🛠️ Managing Deployments:

### View Deployments:
- Railway Dashboard → Project → Deployments tab
- See build logs, status, and rollback options

### Rollback:
- Go to deployment history
- Click "Rollback" on previous working deployment

### Environment Variables:
- Set in Railway dashboard (not in code)
- Changes trigger new deployment automatically

## 🚨 Troubleshooting Auto-Deploy:

### Build Fails:
- Check Railway build logs
- Ensure Dockerfiles are correct
- Verify all dependencies in package.json

### Environment Issues:
- Check variables are set in Railway dashboard
- Some changes require service restart

### Database Issues:
- Run migrations manually: `railway run npx prisma migrate deploy`
- Check DATABASE_URL is correct

## 💡 Best Practices:

1. **Test locally first** before pushing
2. **Use feature branches** for development
3. **Merge to master** only when ready
4. **Monitor deployments** in Railway dashboard
5. **Keep environment variables** in Railway (not in code)
6. **Use Railway's free tier** for development

## 🔗 Useful Links:

- [Railway GitHub Integration](https://docs.railway.app/deploy/git)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Railway Deploy Hooks](https://docs.railway.app/deploy/deployments)

---

**Your project is ready for automatic deployment!** 🎉

Just connect your GitHub repo to Railway and every push to master will automatically deploy all services.