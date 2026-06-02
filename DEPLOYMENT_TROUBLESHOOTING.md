# PM2 Deployment Troubleshooting Guide

## Problem: "Process X not found" or EADDRINUSE errors

### Root Causes
1. **Single-core server with cluster mode** — Multiple Next.js instances try to bind same port
2. **Stale PM2 dump file** — Old process IDs remain after crashes  
3. **Startup script runs per-process** — Migrations/checks running multiple times
4. **pnpm/shell wrapper** — PM2 can't properly manage subprocess lifecycles

### Solution Implemented

#### 1. **ecosystem.config.js** — Fork mode for single-core
```javascript
// Before: instances: 'max', exec_mode: 'cluster'
// After: instances: 1, exec_mode: 'fork'
```
- Fork mode = one simple process per app
- No port conflicts on 1-CPU systems
- Simpler, more stable

#### 2. **Direct Next.js execution**
```javascript
// Before: script: 'pnpm', args: 'start'
// After: script: 'node_modules/.bin/next', args: 'next start --hostname 127.0.0.1 --port 3000'
```
- Removes shell wrapper complexity
- PM2 can monitor and restart cleanly
- Better signal handling

#### 3. **Separate startup checks from PM2**
```bash
# Old: droplet-start.sh runs migrations per-PM2-process
# New: deploy.sh runs migrations ONCE before PM2 starts
```
- Migrations only run once during deployment
- FreeRADIUS/WireGuard checks only run once
- PM2 just manages the running process

#### 4. **Clean PM2 state on each deploy**
```bash
# Added at deploy.sh step 0:
pm2 kill 2>/dev/null || true  # Kill daemon to remove stale processes
sleep 1
# Then fresh start with pm2 start
```

## Quick Fix for Running Servers

### If you see "Process X not found":
```bash
# On the VPS (dangerous — kills all apps):
pm2 delete all
pm2 kill
sleep 2

# Then redeploy:
./deploy.sh
```

### If backend won't start:
```bash
# Check logs
pm2 logs backend --lines 100

# Verify port is free
ss -tlnp | grep :3000

# Check if Next.js can build
cd /var/www/Hq-investment-billingsystem/backend
pnpm exec next build

# Manually test
pnpm run next:start
```

### If database migrations fail:
```bash
# Run from backend directory
cd /var/www/Hq-investment-billingsystem/backend
source ../.env  # load DATABASE_URL
pnpm exec prisma migrate deploy

# If stuck, reset (dev only!):
pnpm exec prisma db push  # WARNING: loses data
```

## Key Changes Summary

| Component | Before | After |
|-----------|--------|-------|
| **Exec mode** | cluster (instances: max) | fork (instances: 1) |
| **Script** | pnpm → script | Direct node_modules/.bin/next |
| **Migrations** | Per PM2 instance | Once during deploy |
| **PM2 startup** | reload/restart | kill + start fresh |
| **Checks** | Per process | Once during deploy |

## Prevention

1. **Always deploy from repo root:**
   ```bash
   cd /var/www/Hq-investment-billingsystem
   ./deploy.sh
   ```

2. **Monitor PM2:**
   ```bash
   pm2 monit              # Live dashboard
   pm2 logs backend       # Tail backend logs
   pm2 show backend       # Process details
   ```

3. **Backup PM2 config:**
   ```bash
   pm2 save               # Save current state (for resurrect on reboot)
   pm2 startup systemd    # Auto-start on boot
   ```

4. **Single-core considerations:**
   - Don't use `instances: 'max'` — set to 1
   - Fork mode (simple) not cluster mode
   - One app instance per server

## Testing Locally

Before deploying, test ecosystem config:
```bash
# List what PM2 would start
pm2 list ecosystem.config.js

# Dry run (don't actually start)
pm2 describe ecosystem.config.js
```
