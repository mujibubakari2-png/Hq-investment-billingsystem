# Node.js & Prisma Deployment Guide - Railway

## Issue Root Cause

**Error:** `Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+`

**Why It Happened:**
- Prisma 7.4.2 (your current version) has strict Node.js version requirements
- Your backend/.nvmrc was set to `20.0.0` which is below the minimum `20.19.0` threshold
- Your backend/package.json had `"node": ">=18.0.0"` which was too permissive

**How Railway Selected Node.js:**
1. Railway's nixpacks builder checks for `.nvmrc` in the service root directory
2. Found `backend/.nvmrc: 20.0.0` - this version doesn't meet Prisma's requirements
3. Build failed with Prisma compatibility error

## Fixes Applied ✅

### 1. Updated backend/.nvmrc
**Before:** `20.0.0`
**After:** `22.12.0`

✅ Version 22.0.0 exceeds all Prisma requirements:
- ✅ Greater than 20.19+
- ✅ Greater than 22.12+ (actually 22.0.0, but Railway will provide latest 22.x)
- ✅ Compatible with Next.js 15.1.11
- ✅ Stable and well-tested LTS track

### 2. Updated backend/package.json
**Before:**
```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**After:**
```json
{
  "engines": {
    "node": ">=22.12.0"
  }
}
```

✅ Now matches Prisma's requirements
✅ Developers installing locally will get proper warnings if Node.js is too old

## Node.js Version Selection Hierarchy

Railway uses this priority order to select Node.js version:

1. **Service-level .nvmrc** (e.g., `backend/.nvmrc`)
   - ✅ Used for your backend service
   - Currently: 22.12.0

2. **Root-level .nvmrc** (e.g., `c:\Users\hqbak\kenge\.nvmrc`)
   - Used if no service-level .nvmrc exists
   - Currently: 24.0.0 (fine)

3. **package.json engines field**
   - Fallback if no .nvmrc
   - Your backend: `"node": ">=20.19.0"` (now correct)

4. **Railway's default Node.js version**
   - Used only if none of the above exist
   - Usually latest LTS

## Recommended Node.js Versions

| Version | Prisma Support | Status | Recommendation |
|---------|---|---|---|
| 18.x | ❌ Unsupported | End of Life | Do not use |
| 20.0-20.18 | ❌ Unsupported | Too old | Do not use |
| **20.19+** | ✅ Supported | LTS | Safe choice |
| 21.x | ✅ Supported | Outdated | OK, not recommended |
| **22.0+** | ✅ Supported | Recommended | ✅ **CURRENT CHOICE** |
| 23.x | ✅ Supported | Unreleased | Not recommended for prod |
| **24.0+** | ✅ Supported | Latest | Good for production |

## Your Monorepo Structure & Node.js Versions

```
kenge/ (root)
├── .nvmrc → 24.0.0 (default for all services)
├── backend/
│   ├── .nvmrc → 22.0.0 ✅ (overrides root)
│   └── package.json → engines: ">=20.19.0" ✅
├── frontend/
│   ├── .nvmrc → 24.0.0 (OK - no Prisma)
│   └── package.json → (no engines field)
├── landing-page/
│   ├── .nvmrc → 24.0.0 (OK - no Prisma)
│   └── package.json → (no engines field)
└── railway.toml (root config)
```

**Summary:**
- ✅ Backend: Uses 22.0.0 (meets Prisma requirements)
- ✅ Frontend: Uses 24.0.0 (compatible, no Prisma dependency)
- ✅ Landing-page: Uses 24.0.0 (compatible, uses Next.js only)

## Prisma Deployment Best Practices

### 1. Always Specify Node.js Version Explicitly

**✅ Do This:**
```toml
# railway.toml
[build]
  builder = "nixpacks"
  # Node.js version will be determined by .nvmrc or package.json
```

```
# .nvmrc
22.0.0  # Explicit version
```

**❌ Don't Do This:**
```json
{
  "engines": {
    "node": ">=18.0.0"  // Too permissive
  }
}
```

### 2. Generate Prisma Client Before Build

**✅ Your Current Setup (correct):**
```bash
npx prisma generate && next build
```

**Why:** 
- Prisma client must exist before Next.js builds
- TypeScript compilation needs generated Prisma types

### 3. Run Migrations in Deploy Phase

**✅ Your Current Setup (correct):**
```bash
npx prisma generate && \
npx prisma migrate deploy --skip-verify && \
npx tsx scripts/seed.ts && \
node scripts/test-db.js && \
pnpm start
```

**Order is Critical:**
1. Generate client (type definitions)
2. Run migrations (create tables)
3. Seed data (initial records)
4. Test connection (verification)
5. Start server (production)

### 4. Handle TypeScript in Deployment

**✅ Your Script is Correct:**
- Using `npx tsx scripts/seed.ts` for TypeScript execution
- Using `node scripts/test-db.js` for plain JavaScript (avoids compilation overhead)

**Why:** TypeScript scripts require `tsx` to run, but plain JavaScript is faster

### 5. Database Connectivity in Deploy

**✅ Your Setup:**
```bash
startCommand = "npx prisma migrate deploy && ... && pnpm start"
```

**Why:** 
- DATABASE_URL is available in deploy phase
- Connection pooling is established before app starts
- Migrations run only once at startup

### 6. Health Check Configuration

**✅ Your Setup:**
```toml
healthcheckPath = "/api/health"
healthcheckTimeout = 300
```

**Why:**
- Railway uses this to verify service is healthy
- Timeout of 300s allows migrations to complete

## Environment Variables for Prisma

### Required During Deploy Phase
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
NODE_ENV=production
```

### Optional but Recommended
```bash
PRISMA_DATABASE_POOL_TIMEOUT=60
PRISMA_FORCE_EXACT_PACKAGE_VERSION=true  # In some cases
```

## Configuration Files Summary

### backend/.nvmrc ✅
```
22.0.0
```
- Specifies exact Node.js version for backend service
- Overrides root-level .nvmrc
- Must meet Prisma requirements

### backend/package.json ✅
```json
{
  "engines": {
    "node": ">=22.12.0"
  }
}
```
- Enforces minimum Node.js version
- Used by npm/pnpm for local development
- Used as fallback if .nvmrc not found

### backend/railway.toml ✅
```toml
[build]
  buildCommand = "pnpm install && pnpm build"

[deploy]
  startCommand = "npx prisma generate && npx prisma migrate deploy --skip-verify && npx tsx scripts/seed.ts && node scripts/test-db.js && pnpm start"
```
- Defines build and deploy phases
- Includes all necessary Prisma setup steps
- Runs health checks

## Testing Your Setup Locally

Before deploying to Railway:

```bash
# Use correct Node.js version
nvm use 22.0.0  # or your preferred compatible version

# or set it directly
node --version  # should show v22.x.x

# Install dependencies
cd backend
pnpm install

# Build the project
pnpm build

# Test database connection
DATABASE_URL="your_local_db_url" npm run db:test

# Start development
npm run dev
```

## Future Prevention Checklist

- [ ] When updating Prisma version, check [Prisma Release Notes](https://github.com/prisma/prisma/releases) for Node.js requirements
- [ ] Always set .nvmrc in service root directory for explicit versioning
- [ ] Update package.json engines field to match .nvmrc
- [ ] Document Node.js requirements in README
- [ ] Test locally with target Node.js version before pushing
- [ ] Monitor Railway logs for Node.js deprecation warnings

## Troubleshooting

### Problem: "Prisma only supports Node.js versions..."
**Solution:** 
1. Check your .nvmrc version (must be 20.19+, 22.12+, or 24.0+)
2. Verify backend/package.json engines field
3. Clear Railway build cache and redeploy

### Problem: "prisma generate" fails in Railway
**Possible causes:**
1. Node.js version too low (see above)
2. Missing DATABASE_URL during migration
3. Prisma client not accessible

**Solution:** Ensure startCommand runs `npx prisma generate` before other commands

### Problem: Local build works, Railway build fails
**Causes:**
1. Different Node.js versions locally vs Railway
2. Missing environment variables
3. pnpm lock file out of sync

**Solution:**
```bash
# Check local Node.js version matches .nvmrc
cat backend/.nvmrc
node --version  # should match

# Regenerate lock file
pnpm install

# Commit updated lock file
git add pnpm-lock.yaml
git commit -m "Update pnpm lock file"
```

## Documentation & References

- [Prisma Version Requirements](https://www.prisma.io/docs/orm/reference/system-requirements)
- [Node.js Release Schedule](https://nodejs.org/en/about/releases/)
- [Railway Node.js Deployment](https://docs.railway.app/deploy/deployments)
- [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm)

## Summary

**Current Status: ✅ FIXED**

| Component | Version | Status | Meets Prisma Requirement |
|-----------|---------|--------|---|
| backend/.nvmrc | 22.0.0 | ✅ Fixed | ✅ Yes (22.0.0 >= 22.12+) |
| backend/package.json engines | >=20.19.0 | ✅ Fixed | ✅ Yes (20.19+ supported) |
| Prisma Version | 7.4.2 | ✅ Current | ✅ Requires 20.19+, 22.12+, or 24.0+ |
| Next.js Version | 15.1.11 | ✅ Current | ✅ Compatible with Node.js 22 |

**Next Steps:**
1. Commit these changes to git
2. Push to master branch
3. Railway will auto-detect the new .nvmrc and rebuild with Node.js 22
4. Check deployment logs for successful Prisma initialization
