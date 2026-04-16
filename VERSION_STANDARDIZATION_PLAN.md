# Version Standardization Plan

## Executive Summary

Standardize versions across the ISP Billing System to ensure compatibility, consistency, and access to latest features.

**Current Status:**
- Backend: Next.js 16.1.6 ✅ Latest
- Frontend: React 19.2.0 ✅ Latest  
- Landing Page: Next.js 15.1.6 ⚠️ Outdated

**Goal:** All components on consistent versions with automated patch updates

---

## 1. Current Version Matrix

### Production Versions

| Component | Dependency | Current | Target | Status | Priority |
|-----------|-----------|---------|--------|--------|----------|
| Backend | Next.js | 16.1.6 | 16.1.6 | ✅ Current | - |
| Backend | Node.js | 18+ | 20+ | ⚠️ Outdated | High |
| Backend | TypeScript | 5.9.3 | 5.9.3 | ✅ Current | - |
| Backend | Prisma | 7.4.2 | 7.4.2 | ✅ Current | - |
| Frontend | React | 19.2.0 | 19.2.0 | ✅ Current | - |
| Frontend | TypeScript | 5.9.3 | 5.9.3 | ✅ Current | - |
| Frontend | Vite | 7.3.1 | 7.3.1 | ✅ Current | - |
| Landing | Next.js | 15.1.6 | 16.1.6 | ⚠️ Behind | High |
| Landing | TypeScript | 5.9.3 | 5.9.3 | ✅ Current | - |

---

## 2. Landing Page Upgrade Plan

### Phase 1: Pre-upgrade Analysis (30 minutes)

```bash
cd landing-page

# Check dependencies
npm audit

# Check breaking changes
npm info next@16.1.6

# List current dependencies
npm list
```

### Phase 2: Backup & Setup (15 minutes)

```bash
# Create backup branch
git checkout -b landing-upgrade-backup
git commit -am "Backup before Next.js upgrade"
git checkout -b landing-upgrade

# Save current state
npm list > DEPENDENCIES_BEFORE.txt
```

### Phase 3: Update Dependencies (45 minutes)

```bash
# Update Next.js and related dependencies
npm update next@16.1.6
npm update typescript@latest

# Install any new peer dependencies
npm install

# Audit and fix vulnerabilities
npm audit fix

# List updated dependencies
npm list > DEPENDENCIES_AFTER.txt
```

### Phase 4: Verify Build (30 minutes)

```bash
# Run type check
npm run lint

# Build for production
npm run build

# Check build output
ls -la .next/
```

### Phase 5: Test (45 minutes)

```bash
# Run development server
npm run dev

# Visit http://localhost:3000
# Test all pages manually
# Check console for errors
# Verify all links work

# Run any existing tests
npm run test
```

### Phase 6: Deploy to Staging (30 minutes)

```bash
# Tag release
git tag landing-v16.1.6

# Deploy to staging
npm run deploy:staging

# Run smoke tests
npm run test:e2e:staging
```

### Phase 7: Merge & Deploy (15 minutes)

```bash
# Merge to main
git checkout main
git merge landing-upgrade

# Tag production release
git tag landing-prod-v16.1.6

# Deploy to production
npm run deploy:prod
```

---

## 3. Breaking Changes & Migrations

### Next.js 15 → 16 Changes

#### 1. Image Optimization
```typescript
// Before (15.x)
import Image from 'next/image';

<Image 
  src="/image.png" 
  layout="responsive" 
  width={100} 
  height={100}
/>

// After (16.x)
import Image from 'next/image';

<Image 
  src="/image.png"
  alt="Description"
  width={100}
  height={100}
  responsive
/>
```

#### 2. Font Loading
```typescript
// Before (15.x)
import '@next/font/google';

const inter = Inter({ subsets: ['latin'] });

// After (16.x)
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
```

#### 3. Dynamic Imports
```typescript
// Before (15.x)
const Component = dynamic(() => import('./Component'), {
  loading: () => <p>Loading...</p>,
});

// After (16.x)
import dynamic from 'next/dynamic';

const Component = dynamic(() => import('./Component'), {
  loading: () => <p>Loading...</p>,
  ssr: true,
});
```

### Migration Scripts

```typescript
// scripts/migrateNextVersion.ts
import fs from 'fs';
import path from 'path';

const migrateImageImports = (filePath: string) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Migrate old Image props
  content = content.replace(
    /layout="responsive"/g,
    'responsive'
  );
  
  fs.writeFileSync(filePath, content);
};

const migrateFontImports = (filePath: string) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Migrate font imports
  content = content.replace(
    /from '@next\/font\/google'/g,
    "from 'next/font/google'"
  );
  
  fs.writeFileSync(filePath, content);
};

const walkDir = (dir: string, callback: (file: string) => void) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filePath);
    }
  });
};

// Run migrations
const srcDir = path.join(__dirname, '../src');
walkDir(srcDir, (file) => {
  migrateImageImports(file);
  migrateFontImports(file);
  console.log(`Migrated: ${file}`);
});
```

---

## 4. Version Lock File

Create `.version-matrix.json` in root:

```json
{
  "project": "ISP Billing System",
  "lastUpdated": "2026-04-16",
  "updateCycle": "monthly",
  
  "versions": {
    "backend": {
      "name": "Next.js API Server",
      "next": "16.1.6",
      "typescript": "5.9.3",
      "prisma": "7.4.2",
      "node": "20.x LTS",
      "releaseDate": "2024-12-01",
      "nextMajor": "17.0.0",
      "eol": "2026-12-01"
    },
    "frontend": {
      "name": "React SPA",
      "react": "19.2.0",
      "typescript": "5.9.3",
      "vite": "7.3.1",
      "node": "20.x LTS",
      "releaseDate": "2024-12-15",
      "nextMajor": "20.0.0",
      "eol": "2026-12-15"
    },
    "landing": {
      "name": "Next.js Landing Page",
      "next": "16.1.6",
      "typescript": "5.9.3",
      "node": "20.x LTS",
      "releaseDate": "2024-12-01",
      "nextMajor": "17.0.0",
      "eol": "2026-12-01"
    }
  },

  "shared": {
    "node": "20.13.0",
    "npm": "10.5.0"
  },

  "patchUpdatePolicy": {
    "frequency": "weekly",
    "automatic": true,
    "severity": "patch",
    "testRequired": true
  },

  "minorUpdatePolicy": {
    "frequency": "monthly",
    "automatic": false,
    "severity": "minor",
    "reviewRequired": true,
    "testingRequired": true
  },

  "majorUpdatePolicy": {
    "frequency": "as-needed",
    "automatic": false,
    "severity": "major",
    "planningRequired": true,
    "fullTestingRequired": true,
    "stagingDeploymentRequired": true
  },

  "dependencies": {
    "breaking": {
      "next": "16.x → 17.x",
      "react": "19.x → 20.x"
    },
    "upcoming": [
      "Node.js 18 EOL: April 2025",
      "Node.js 20 EOL: April 2026"
    ]
  }
}
```

---

## 5. Automated Version Management

### Package.json Scripts

```json
{
  "scripts": {
    "versions:check": "npm outdated && npm audit",
    "versions:update:patch": "npm update --depth 3",
    "versions:update:minor": "npm update --save-dev",
    "versions:update:major": "npm-check-updates -u",
    "versions:lock": "npm ci && npm shrinkwrap",
    "versions:compare": "node scripts/compareVersions.js",
    "versions:report": "node scripts/generateVersionReport.js"
  }
}
```

### GitHub Actions: Version Check Workflow

```yaml
# .github/workflows/version-check.yml
name: Version Check

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  version-check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Check outdated packages
        run: npm outdated || true
      
      - name: Run security audit
        run: npm audit || true
      
      - name: Create issue for updates
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Dependencies update available',
              body: 'Run `npm outdated` to see available updates'
            })
```

### GitHub Actions: Auto-patch Updates

```yaml
# .github/workflows/auto-patch-update.yml
name: Auto Patch Update

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  update:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Update patch versions
        run: npm update
      
      - name: Run tests
        run: npm run test
      
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v4
        with:
          commit-message: 'ci: update patch dependencies'
          title: 'Dependency updates (patch)'
          branch: auto/patch-update
          delete-branch: true
```

---

## 6. Node.js Version Upgrade Plan

### Current: 18.x → Target: 20.x LTS

```bash
# Check current Node version
node --version

# Install Node 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version
npm --version

# Test projects
cd backend && npm run build
cd ../frontend && npm run build
cd ../landing-page && npm run build
```

---

## 7. Dependency Security Policy

### Annual Audit Schedule
```
January - Review & plan major updates
February - Test and stage major updates
March - Deploy major updates
April-December - Monthly patch updates
```

### Security Incident Response
```
Critical (0-9): Fix within 24 hours
High (7-8.9): Fix within 7 days
Medium (4-6.9): Fix within 30 days
Low (0-3.9): Fix in regular updates
```

---

## 8. Testing Strategy for Version Updates

### Pre-Update Checklist
- [ ] Backup current version
- [ ] Review breaking changes
- [ ] Identify affected code
- [ ] Run full test suite
- [ ] Check CI/CD pipeline

### Post-Update Checklist
- [ ] Run type checking
- [ ] Run linting
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run E2E tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Staging deployment
- [ ] Production deployment

---

## 9. Documentation Updates

### After Each Upgrade

1. **Update README.md**
   ```markdown
   ## Requirements
   - Node.js 20.x LTS
   - npm 10.x
   - Next.js 16.1.6 (backend)
   - React 19.2.0 (frontend)
   ```

2. **Update CONTRIBUTING.md**
   ```markdown
   ### Local Setup
   1. Install Node.js 20.x
   2. Clone repository
   3. Run: `npm install`
   4. See `.version-matrix.json` for version info
   ```

3. **Update Deployment Docs**
   - Specify Node version in deployment config
   - Update Docker base images
   - Update CI/CD Node version

---

## 10. Timeline & Milestones

### Week 1: Planning & Preparation
- [ ] Document current state
- [ ] Identify breaking changes
- [ ] Create migration scripts
- [ ] Plan testing strategy

### Week 2: Landing Page Upgrade
- [ ] Update dependencies
- [ ] Run migrations
- [ ] Fix breaking changes
- [ ] Test thoroughly

### Week 3: Node.js Upgrade
- [ ] Upgrade to Node.js 20.x
- [ ] Test all projects
- [ ] Update CI/CD
- [ ] Update documentation

### Week 4: Monitoring & Optimization
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Optimize if needed
- [ ] Document results

---

## 11. Rollback Plan

If issues arise after upgrade:

```bash
# Immediate rollback
git revert <commit-hash>
npm install
npm run build
npm run deploy:prod

# Extended rollback
git checkout <previous-tag>
nvm use 18  # or previous Node version
npm install
npm run build
npm run deploy:prod

# Root cause analysis
npm audit
npm list
npm outdated
```

---

## 12. Success Metrics

- ✅ All components on consistent versions
- ✅ Zero breaking change errors
- ✅ All tests passing
- ✅ Performance metrics maintained
- ✅ Security audit clean
- ✅ Documentation updated

---

## 13. Ongoing Maintenance

### Monthly
- Check for new patch versions
- Run security audits
- Apply patches automatically
- Merge auto-update PRs

### Quarterly
- Review minor version updates
- Plan and test minor upgrades
- Update documentation

### Annually
- Plan major version upgrades
- Review EOL dates
- Update roadmap

---

## Conclusion

Standardizing versions across the ISP Billing System ensures:
- ✅ Consistency and compatibility
- ✅ Access to latest security patches
- ✅ Improved performance and features
- ✅ Reduced technical debt
- ✅ Easier onboarding for new developers

**Next Step:** Execute landing page upgrade from Next.js 15.1.6 to 16.1.6

