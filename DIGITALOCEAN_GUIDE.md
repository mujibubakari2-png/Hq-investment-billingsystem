# DigitalOcean Deployment Guide

This guide explains how to deploy the Kenge ISP Billing System to DigitalOcean using the App Platform.

## Prerequisites
1. A DigitalOcean account.
2. The project pushed to a GitHub or GitLab repository.

## Step 1: Prepare the `app.yaml`
I have created an `app.yaml` file in the root of your project. This file contains the "App Spec" which tells DigitalOcean how to:
- Build and run the **Backend** (Next.js + Prisma)
- Build and run the **Landing Page** (Next.js)
- Build and host the **Frontend** (Vite Static Site)
- Provision a **Managed PostgreSQL** database

## Step 2: Deploy to DigitalOcean
1. Log in to the [DigitalOcean Cloud Console](https://cloud.digitalocean.com/).
2. Click **"Apps"** in the sidebar.
3. Click **"Create"** -> **"App"**.
4. Select **"GitHub"** (or your provider) and choose this repository.
5. DigitalOcean may try to auto-detect services. Instead, look for an option to **"Upload an App Spec"** or **"Launch using App Spec"**.
   - If you can't find the upload button, you can proceed with the UI but ensure the `Source Directory` for each service is set correctly:
     - `backend` -> `backend`
     - `frontend` -> `frontend`
     - `landing-page` -> `landing-page`
6. **Managed Database**: DigitalOcean will see the `databases` section in `app.yaml` and create a PostgreSQL instance for you.

## Step 3: Configure Environment Variables
In the DigitalOcean Dashboard, go to the **Settings** tab for your App and ensure these are set:

### Backend Service
- `DATABASE_URL`: (Automatically linked to the managed database)
- `JWT_SECRET`: Generate a random string (e.g., `openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `CORS_ORIGIN`: Set to your Frontend URL (DO will provide this)

### Frontend Service (Static Site)
- `VITE_API_URL`: Set to your Backend URL + `/api` (e.g., `https://backend-xxx.ondigitalocean.app/api`)

## Step 4: Database Migrations
The `backend` is configured to use Prisma. 
You should run database migrations before starting the backend. You can do this by:
1. Running a one-time console command in DigitalOcean App Platform:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
2. Or updating the start command to run migrations automatically (optional)

## Current Configuration Summary
- **Region**: NYC (New York)
- **Database**: PostgreSQL 16 (Dev Tier)
- **Services**: 2 Web Services, 1 Static Site
