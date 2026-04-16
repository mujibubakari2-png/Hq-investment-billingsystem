# Railway Deployment Guide for Kenge

This guide will help you remove your Render deployment and deploy your project to Railway.

## 📋 Project Overview

Your project has 3 services:
1. **Backend** - Next.js API (Node.js)
2. **Frontend** - React Vite SPA (static)
3. **Landing Page** - Next.js app

---

## ❌ Step 1: Remove from Render

1. Go to [render.com](https://render.com)
2. Navigate to your account dashboard
3. Delete the following services:
   - `kenge-backend` (or whatever your backend service is named)
   - Any frontend/landing-page services
4. This will stop any ongoing charges and remove your deployments

---

## ✅ Step 2: Set Up Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub (recommended for easy access to your repo)
3. Create a new project

---

## Step 3: Create Dockerfiles (Optional but Recommended)

### Backend Dockerfile
Create `backend/Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### Frontend Dockerfile
Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Frontend nginx.conf
Create `frontend/nginx.conf`:
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # SPA routing - serve index.html for all non-file routes
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache assets with long expiration
        location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Landing Page Dockerfile
Create `landing-page/Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

---

## Step 4: Set Up Environment Variables in Railway

### Backend Service - Environment Variables:
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[dbname]
JWT_SECRET=[generate-a-random-secret]
GOOGLE_CLIENT_ID=[your-google-client-id]
GOOGLE_CLIENT_SECRET=[your-google-client-secret]
SMTP_HOST=[your-smtp-host]
SMTP_PORT=587
SMTP_USER=[your-smtp-user]
SMTP_PASSWORD=[your-smtp-password]
SMTP_FROM=[sender@email.com]
NODE_ENV=production
```

### Frontend Service - Environment Variables:
```
VITE_API_URL=https://[your-backend-service-url]
VITE_GOOGLE_CLIENT_ID=[your-google-client-id]
```

### Landing Page - Environment Variables:
```
(Usually none required unless you have specific configs)
```

---

## Step 5: Deploy on Railway

### Option A: Using Railway Dashboard (Easy)

1. **Create Backend Service:**
   - In Railway, click "New Project" → "GitHub Repo"
   - Select your repository
   - Connect to your GitHub account if needed
   - Railway will auto-detect and create a service from the repo root
   - Add a PostgreSQL plugin (Railway dashboard → Add service → Database → PostgreSQL)
   - Set environment variables from the list above
   - Railway will auto-deploy on every git push

2. **Create Frontend Service:**
   - Add another service from the same repo
   - Set root directory to `frontend/`
   - Add build command: `npm run build`
   - Add start command: `npm run preview` or configure to serve static files
   - Set environment variables

3. **Create Landing Page Service:**
   - Add another service from the same repo
   - Set root directory to `landing-page/`
   - Add build command: `npm run build`
   - Add start command: `npm start`
   - Set environment variables

### Option B: Using Railway CLI (Advanced)

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Create a new project:
   ```bash
   railway init
   ```

4. Add services and deploy:
   ```bash
   # Deploy backend
   cd backend
   railway up --name backend

   # Deploy frontend
   cd ../frontend
   railway up --name frontend

   # Deploy landing page
   cd ../landing-page
   railway up --name landing-page
   ```

---

## Step 6: Update Your Application Config

### Update Frontend API URL

After backend is deployed on Railway, update `frontend/.env.production`:
```
VITE_API_URL=https://[your-railway-backend-url]
```

Also update any hardcoded URLs in your code:
- Search for `kenge-backend.onrender.com` and replace with your Railway backend URL
- Update any other Render references

---

## Step 7: Set Up PostgreSQL Database

1. In Railway dashboard, add PostgreSQL as a plugin
2. Copy the connection string (DATABASE_URL)
3. Add it to backend environment variables
4. Run migrations: `npx prisma migrate deploy`
5. Seed database if needed: `npx prisma db seed`

---

## Step 8: Configure Domains

1. In Railway dashboard for each service:
   - Generate a Railway domain (automatic)
   - Or connect your custom domain
2. Update your application to use the correct URLs

---

## Environment Variables Summary

**Critical variables to set:**
- `DATABASE_URL` - PostgreSQL connection string (set automatically by Railway if using Railway Postgres)
- `JWT_SECRET` - Generate with: `openssl rand -hex 32`
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `VITE_API_URL` - Backend URL for frontend

---

## Common Issues

1. **Build fails**: Ensure all dependencies are in package.json
2. **Environment variables not found**: Double-check they're set in Railway dashboard
3. **Database connection fails**: Verify DATABASE_URL format and network access
4. **Frontend can't reach backend**: Check CORS settings in backend
5. **Port conflicts**: Make sure services use correct ports (Backend: 3001, Frontend: static/80, Landing: 3000)

---

## Rollback (If needed)

To go back to Render:
1. Keep your Render configuration or recreate it
2. The process is similar - set env vars and deploy

---

## Support

- Railway Docs: https://docs.railway.app
- Prisma Docs: https://www.prisma.io/docs/
- Next.js Docs: https://nextjs.org/docs
