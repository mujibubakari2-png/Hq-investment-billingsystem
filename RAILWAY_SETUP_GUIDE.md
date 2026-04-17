# Railway Deployment Configuration Guide

## Issue
Your frontend, backend, and landing page are deployed but not connected because the environment variables for production URLs are not set.

## Solution: Set Environment Variables in Railway

### Backend Service Configuration
Set these environment variables in your Railway backend service:

```
CORS_ORIGIN=https://frontend-production-8781.up.railway.app
NODE_ENV=production
JWT_SECRET=<generate a new 64-character random string>
```

**Steps to set in Railway:**
1. Go to your Railway dashboard → Backend service
2. Click on "Variables" tab
3. Add/update these variables:
   - `CORS_ORIGIN` = `https://frontend-production-8781.up.railway.app`
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = Generate using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Keep `DATABASE_URL` (Railway auto-sets this)

### Frontend Service Configuration
Set these environment variables in your Railway frontend service:

```
VITE_API_URL=https://backend-production-e0c5.up.railway.app
VITE_GOOGLE_CLIENT_ID=<your Google Client ID if using>
```

**Steps to set in Railway:**
1. Go to your Railway dashboard → Frontend service
2. Click on "Variables" tab
3. Add/update these variables:
   - `VITE_API_URL` = `https://backend-production-e0c5.up.railway.app`
   - `VITE_GOOGLE_CLIENT_ID` = Your Google OAuth Client ID (or leave empty)

### Landing Page Service Configuration (Optional)
If the landing page needs backend access:
```
VITE_API_URL=https://backend-production-e0c5.up.railway.app
VITE_GOOGLE_CLIENT_ID=<your Google Client ID if using>
```

## Important Notes

1. **No trailing slashes** in URLs
2. **CORS_ORIGIN** must exactly match your frontend URL
3. **JWT_SECRET** should be unique and secure (at least 32 characters)
4. After setting variables, **restart all services** in Railway
5. Test the connection by accessing your frontend and trying to login

## How to Generate JWT_SECRET

Option 1 (Node.js):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Option 2 (PowerShell):
```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## Testing Connection

After setting all variables and restarting services:
1. Visit `https://frontend-production-8781.up.railway.app`
2. Try to login with credentials (admin/admin123)
3. Check browser console (F12) for any errors
4. Check Railway service logs for backend errors

## Troubleshooting

**If still not connecting:**
1. Check backend service logs in Railway for CORS or connection errors
2. Verify exact URLs match (no trailing slashes, correct domain)
3. Restart all services after changing variables
4. Clear browser cache (Ctrl+Shift+Delete)
5. Check that backend service is healthy (green status in Railway)

## Database

The DATABASE_URL should already be set by Railway's PostgreSQL plugin. If not:
1. Add a PostgreSQL service in your Railway project
2. Add `DATABASE_URL` variable that Railway auto-generates
