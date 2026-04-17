# API Versioning Strategy & Implementation Guide

## Overview

API versioning allows the system to evolve without breaking existing clients. This guide covers implementing semantic versioning for ISP Billing System APIs.

---

## 1. Versioning Strategy

### Semantic Versioning (SemVer)
Follow **MAJOR.MINOR.PATCH** format:

- **MAJOR**: Breaking changes (requires client updates)
- **MINOR**: Backward-compatible additions
- **PATCH**: Bug fixes and non-breaking improvements

**Example:** `v1.2.3`

### Current Versions
- **Backend API**: `v1.0.0` (Next.js 16.1.6)
- **Landing Page**: `v1.0.0` (Next.js 15.1.6)
- **Frontend**: `v1.0.0` (React 19.2.0)

---

## 2. API Versioning Patterns

### URL Path Versioning (Recommended)
```typescript
GET /api/v1/clients
GET /api/v2/clients  // Future breaking change
```

**Pros:** Clear, cacheable, easy to debug  
**Cons:** URL proliferation

### Header-based Versioning
```
GET /api/clients
Header: Accept-Version: v1
```

**Pros:** Cleaner URLs  
**Cons:** Less visible, harder to debug

### Query Parameter Versioning
```
GET /api/clients?version=v1
```

**Pros:** Flexible  
**Cons:** Easy to miss, not RESTful

---

## 3. Implementation

### URL Path Versioning (Recommended Approach)

#### Backend Routes Structure
```
backend/
├── src/
│   └── app/
│       └── api/
│           ├── v1/
│           │   ├── clients/
│           │   │   ├── route.ts
│           │   │   └── [id]/
│           │   ├── packages/
│           │   ├── routers/
│           │   └── auth/
│           ├── v2/          # Future endpoint (when breaking changes needed)
│           │   ├── clients/
│           │   └── ...
│           └── health/       # Version-agnostic endpoints
```

#### Example Implementation

**backend/src/app/api/v1/clients/route.ts:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { handleAsyncError } from '@/lib/errorHandler';
import { sanitizeObject } from '@/lib/sanitization';
import { rateLimitMiddleware } from '@/middleware/rateLimiter';
import { csrfMiddleware } from '@/middleware/csrfProtection';

export const apiVersion = 'v1';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = rateLimitMiddleware(request);
  if (rateLimitResult) return rateLimitResult;

  return handleAsyncError(
    async () => {
      // Get clients
      const clients = await prisma.client.findMany();
      return NextResponse.json({
        version: apiVersion,
        status: 'success',
        data: clients,
      });
    },
    (error) => {
      return NextResponse.json(
        { version: apiVersion, error: error.message },
        { status: 500 }
      );
    }
  );
}

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfResult = csrfMiddleware(request);
  if (csrfResult) return csrfResult;

  // Rate limiting
  const rateLimitResult = rateLimitMiddleware(request);
  if (rateLimitResult) return rateLimitResult;

  return handleAsyncError(
    async () => {
      const body = await request.json();
      const sanitized = sanitizeObject(body);

      // Validate and create
      const client = await prisma.client.create({
        data: sanitized as any,
      });

      return NextResponse.json(
        { version: apiVersion, data: client, status: 'created' },
        { status: 201 }
      );
    },
    (error) => {
      return NextResponse.json(
        { version: apiVersion, error: error.message },
        { status: 400 }
      );
    }
  );
}
```

#### Shared Response Wrapper
```typescript
// backend/src/lib/apiResponse.ts
export interface ApiResponse<T = unknown> {
  version: string;
  status: 'success' | 'error' | 'created' | 'updated' | 'deleted';
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

export function createApiResponse<T>(
  version: string,
  status: ApiResponse['status'],
  data?: T,
  error?: string
): ApiResponse<T> {
  return {
    version,
    status,
    data,
    error,
    timestamp: new Date().toISOString(),
  };
}
```

---

## 4. Version Deprecation

### Deprecation Timeline
```typescript
// backend/src/app/api/v1/_middleware.ts
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add deprecation headers
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
  response.headers.set(
    'Link',
    '</api/v2/docs>; rel="successor-version"'
  );

  return response;
}
```

### Deprecation Notice
```
Deprecation: true
Sunset: Wed, 15 Jul 2026 23:59:59 GMT
Link: </api/v2/docs>; rel="successor-version"
```

---

## 5. Frontend API Client Updates

### Version-aware Client
```typescript
// frontend/src/api/v1Client.ts
import axios from 'axios';

const V1_BASE_URL = '/api/v1';

export const v1Client = axios.create({
  baseURL: V1_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'X-API-Version': 'v1',
  },
});

// Versioned API methods
export const v1Api = {
  clients: {
    list: () => v1Client.get('/clients'),
    get: (id: string) => v1Client.get(`/clients/${id}`),
    create: (data: any) => v1Client.post('/clients', data),
  },
};
```

### Version Migration
```typescript
// frontend/src/api/migrations.ts
import { v1Api } from './v1Client';
import { v2Api } from './v2Client'; // Future

export async function migrateClientCalls() {
  // Gradually migrate from v1 to v2
  try {
    // Try v2 first
    return await v2Api.clients.list();
  } catch (error) {
    // Fall back to v1
    if (error.status === 404) {
      return await v1Api.clients.list();
    }
    throw error;
  }
}
```

---

## 6. Documentation

### Swagger/OpenAPI Updates
```typescript
// backend/src/swagger.config.ts
export default {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ISP Billing System API',
      version: '1.0.0',
    },
    paths: {
      '/api/v1/clients': {
        get: {
          tags: ['v1'],
          description: 'Get all clients (v1)',
          deprecated: false,
        },
      },
      '/api/v2/clients': {
        get: {
          tags: ['v2'],
          description: 'Get all clients (v2 - improved)',
          deprecated: false,
        },
      },
    },
  },
};
```

---

## 7. Version Compatibility Matrix

```markdown
| Client Version | Backend v1 | Backend v2 |
|---|---|---|
| Web v1.0 | ✅ | ❌ |
| Web v2.0 | ⚠️  | ✅ |
| Mobile v1.0 | ✅ | ❌ |
| Mobile v2.0 | ✅ | ✅ |
```

---

## 8. Best Practices

### Do's ✅
- Use semantic versioning consistently
- Document all version changes
- Provide migration guides
- Keep old versions for 6-12 months
- Test backward compatibility
- Add deprecation notices early

### Don'ts ❌
- Make breaking changes without major version bump
- Remove endpoints without notice
- Change request/response formats without versioning
- Hide version information
- Maintain more than 2 major versions

---

## 9. Migration Timeline

### Phase 1: Current State (v1.x)
- Backend: v1.0.0 (Next.js 16.1.6)
- Frontend: v1.0.0 (React 19.2.0)
- Landing: v1.0.0 (Next.js 15.1.6)

### Phase 2: Standardization (v1.1)
- Upgrade landing to Next.js 16.1.6
- Add API versioning infrastructure
- Update frontend client

### Phase 3: Future Breaking Changes (v2.0)
- Significant API restructuring
- Remove deprecated endpoints
- Major frontend refactor

---

## 10. Version Standardization Plan

### Action Items

1. **Backend (Next.js 16.1.6)** ✅
   - Already latest version
   - Implement API versioning structure

2. **Landing Page (Next.js 15.1.6)** ⚠️
   - **Action:** Upgrade to Next.js 16.1.6
   - **Timeline:** 1-2 weeks
   - **Steps:**
     ```bash
     cd landing-page
     npm update next@latest
     npm audit fix
     npm run build
     ```

3. **Frontend (React 19.2.0)** ✅
   - Already latest React version
   - Keep dependencies current

### Version Lockfile
Create `.version-matrix.json`:
```json
{
  "backend": {
    "next": "16.1.6",
    "prisma": "7.4.2",
    "typescript": "5.9.3",
    "node": ">=18.0.0"
  },
  "frontend": {
    "react": "19.2.0",
    "typescript": "5.9.3",
    "vite": "7.3.1",
    "node": ">=18.0.0"
  },
  "landing": {
    "next": "16.1.6",
    "typescript": "5.9.3",
    "node": ">=18.0.0"
  }
}
```

---

## 11. Monitoring & Alerts

### Deprecation Monitoring
```typescript
// backend/src/utils/versionMonitoring.ts
export function trackDeprecatedEndpoints() {
  const deprecatedEndpoints = [
    '/api/v1/old-endpoint',
    '/api/v1/legacy-method',
  ];

  return {
    count: deprecatedEndpoints.length,
    endpoints: deprecatedEndpoints,
    notice: 'Migrate to v2 endpoints',
  };
}
```

---

## 12. Rollback Strategy

If issues arise with new version:
1. Detect issue (monitoring alerts)
2. Revert to previous version
3. Document issue
4. Fix in staging
5. Re-deploy

```bash
# Rollback script
git revert <commit-hash>
npm run build
npm run deploy:prod
```

---

## Conclusion

Implementing API versioning ensures backward compatibility while allowing the system to evolve. Start with v1.0.0 as base, standardize versions across components, and plan for future v2.0.0 when major changes are needed.

**Recommended Next Steps:**
1. Implement v1 API routes structure
2. Update landing page to Next.js 16.1.6
3. Add version headers to all API responses
4. Document version deprecation policy
