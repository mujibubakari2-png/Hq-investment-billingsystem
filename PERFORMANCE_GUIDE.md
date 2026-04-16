# Performance Optimization Guide

## Overview

Current performance metrics and optimization strategies for the ISP Billing System.

**Current Status:**
- Bundle Size: 1.4 MB (gzipped: 385 KB) ⚠️
- Code Splitting: Not implemented
- List Virtualization: Not implemented
- API Caching: Not implemented

**Target:**
- Bundle Size: < 800 KB (gzipped)
- Code Splitting: 90%+ of routes
- Large Lists: 100%+ virtualized
- Caching: 80%+ API hit rate

---

## 1. Code Splitting Analysis

### Current Issues
```
Bundle Analysis:
- Main chunk: 1.4 MB (385 KB gzipped)
- No route-based code splitting
- All components loaded upfront
- Dependencies included in main bundle
```

### Bundle Breakdown (Estimated)
| Component | Size | Percent |
|-----------|------|---------|
| React + dependencies | 350 KB | 25% |
| Material-UI + icons | 280 KB | 20% |
| Routing + state | 120 KB | 9% |
| Page components | 250 KB | 18% |
| API client + utils | 150 KB | 11% |
| Other (unused code) | 250 KB | 17% |

---

## 2. Dynamic Import Implementation

### Route-Based Code Splitting

**frontend/src/App.tsx:**
```typescript
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Regular imports for critical pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy load secondary pages
const Clients = lazy(() => import('./pages/Clients'));
const Packages = lazy(() => import('./pages/Packages'));
const Routers = lazy(() => import('./pages/Routers'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

// Loading fallback
const LoadingFallback = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    Loading...
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Critical routes - loaded upfront */}
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Secondary routes - lazy loaded */}
        <Route 
          path="/clients" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Clients />
            </Suspense>
          } 
        />
        <Route 
          path="/packages" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Packages />
            </Suspense>
          } 
        />
        {/* Additional routes... */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Component-Based Code Splitting

```typescript
// frontend/src/modals/ClientModal.tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const ComplexForm = lazy(() => import('./forms/ComplexForm'));
const DataVisualization = lazy(() => import('./charts/DataVisualization'));

export function ClientModal() {
  return (
    <div>
      <Suspense fallback={<div>Loading form...</div>}>
        <ComplexForm />
      </Suspense>
      
      <Suspense fallback={<div>Loading charts...</div>}>
        <DataVisualization />
      </Suspense>
    </div>
  );
}
```

### Manual Chunks Configuration

**frontend/vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // UI Library
          'mui': ['@mui/material', '@mui/icons-material', '@mui/lab'],
          
          // Utilities
          'utils': [
            '@/lib/errorHandler',
            '@/lib/logger',
            '@/lib/validation',
          ],
          
          // API and state
          'api': ['@/api/client', '@/stores'],
          
          // Heavy pages (optional)
          'reports': ['@/pages/Reports', '@/pages/Analytics'],
          'admin': ['@/pages/AdminSettings', '@/pages/UserManagement'],
        },
      },
    },
    chunkSizeWarningLimit: 500, // Warning threshold in KB
  },
});
```

### Expected Bundle Reduction
```
Before: 1.4 MB (385 KB gzipped)
After:
  - Main: 450 KB (120 KB gzipped) ✅ 70% reduction
  - MUI: 280 KB (75 KB gzipped)
  - Utils: 80 KB (25 KB gzipped)
  - API: 120 KB (40 KB gzipped)
  - Routes: Loaded on demand

Total (all chunks): Same
Initial load: 70% faster
```

---

## 3. Virtual Scrolling for Large Lists

### Problem Analysis
```typescript
// Current implementation - loads ALL rows
<table>
  <tbody>
    {items.map(item => <tr key={item.id}>{...}</tr>)} // 1000+ rows!
  </tbody>
</table>

// Performance Impact:
// - DOM: 1000+ nodes rendered
// - Memory: ~50 MB for large lists
// - Rendering: 2-5 seconds
```

### React-Window Implementation

```bash
npm install react-window react-window-infinite-loader
```

**frontend/src/components/VirtualizedTable.tsx:**
```typescript
import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

interface VirtualizedTableProps<T> {
  items: T[];
  rowHeight: number;
  columns: Array<{
    key: keyof T;
    label: string;
    width: string;
  }>;
  onLoadMore: (startIndex: number, stopIndex: number) => void;
  isItemLoaded: (index: number) => boolean;
  itemCount: number;
}

export function VirtualizedTable<T extends { id: string }>({
  items,
  rowHeight = 56,
  columns,
  onLoadMore,
  isItemLoaded,
  itemCount,
}: VirtualizedTableProps<T>) {
  
  // Calculate table width
  const tableWidth = useMemo(
    () => columns.reduce((sum, col) => {
      const width = parseInt(col.width) || 100;
      return sum + width;
    }, 0),
    [columns]
  );

  // Row renderer
  const rowRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = items[index];
      
      if (!isItemLoaded(index)) {
        return (
          <div style={style} className="table-row loading">
            Loading...
          </div>
        );
      }

      return (
        <div style={style} className="table-row">
          {columns.map(col => (
            <div
              key={col.key as string}
              style={{ width: col.width, display: 'inline-block' }}
              className="table-cell"
            >
              {String(item[col.key])}
            </div>
          ))}
        </div>
      );
    },
    [items, columns, isItemLoaded]
  );

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
        onLoadMore(visibleStartIndex, visibleStopIndex);
      }}
    >
      {({ onItemsRendered, ref }) => (
        <List
          ref={ref}
          className="virtual-list"
          height={600}
          itemCount={itemCount}
          itemSize={rowHeight}
          onItemsRendered={onItemsRendered}
          width="100%"
        >
          {rowRenderer}
        </List>
      )}
    </InfiniteLoader>
  );
}
```

**Usage Example:**
```typescript
// frontend/src/pages/Transactions.tsx
import { useState, useCallback } from 'react';
import { VirtualizedTable } from '@/components/VirtualizedTable';
import { transactionsApi } from '@/api/client';

export default function Transactions() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loadedRanges, setLoadedRanges] = useState<Set<number>>(new Set());
  const [totalCount, setTotalCount] = useState(0);

  const handleLoadMore = useCallback(
    async (startIndex: number, stopIndex: number) => {
      // Determine which page needs to be loaded
      const page = Math.floor(startIndex / 50);
      
      if (loadedRanges.has(page)) {
        return; // Already loaded
      }

      try {
        const { data, total } = await transactionsApi.listPaginated({
          page: page + 1,
          limit: 50,
        });

        setItems(prev => {
          const updated = [...prev];
          data.forEach((item, idx) => {
            updated[startIndex + idx] = item;
          });
          return updated;
        });

        setTotalCount(total);
        setLoadedRanges(prev => new Set([...prev, page]));
      } catch (error) {
        console.error('Failed to load transactions:', error);
      }
    },
    [loadedRanges]
  );

  const isItemLoaded = (index: number) => items[index] !== undefined;

  return (
    <VirtualizedTable
      items={items}
      rowHeight={56}
      columns={[
        { key: 'date', label: 'Date', width: '150px' },
        { key: 'reference', label: 'Reference', width: '150px' },
        { key: 'amount', label: 'Amount', width: '100px' },
        { key: 'status', label: 'Status', width: '100px' },
      ]}
      onLoadMore={handleLoadMore}
      isItemLoaded={isItemLoaded}
      itemCount={totalCount}
    />
  );
}
```

### Performance Improvement
```
Before Virtualization:
- 1000 rows: 2-5 seconds load time
- Memory: 50+ MB
- 1000+ DOM nodes

After Virtualization:
- 1000 rows: <500ms load time ✅ 80% faster
- Memory: <5 MB ✅ 90% reduction
- ~20 DOM nodes visible ✅
```

---

## 4. API Caching Strategy

### Cache Layers

```typescript
// frontend/src/lib/cacheManager.ts
export interface CacheConfig {
  ttl: number; // Time to live in ms
  strategy: 'memory' | 'localStorage' | 'hybrid';
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // User data - short TTL (5 minutes)
  '/api/v1/user': { ttl: 5 * 60 * 1000, strategy: 'memory' },
  
  // Lists - medium TTL (15 minutes)
  '/api/v1/clients': { ttl: 15 * 60 * 1000, strategy: 'hybrid' },
  '/api/v1/packages': { ttl: 15 * 60 * 1000, strategy: 'hybrid' },
  '/api/v1/routers': { ttl: 15 * 60 * 1000, strategy: 'hybrid' },
  
  // Static data - long TTL (1 hour)
  '/api/v1/settings': { ttl: 60 * 60 * 1000, strategy: 'hybrid' },
  '/api/v1/countries': { ttl: 24 * 60 * 60 * 1000, strategy: 'localStorage' },
  
  // Real-time data - no cache
  '/api/v1/dashboard/stats': { ttl: 0, strategy: 'memory' },
  '/api/v1/routers/status': { ttl: 0, strategy: 'memory' },
};

export class CacheManager {
  private memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

  getCacheConfig(url: string): CacheConfig {
    for (const [pattern, config] of Object.entries(CACHE_CONFIGS)) {
      if (url.includes(pattern)) {
        return config;
      }
    }
    return { ttl: 0, strategy: 'memory' }; // No cache by default
  }

  async get<T>(url: string): Promise<T | null> {
    const config = this.getCacheConfig(url);
    if (config.ttl === 0) return null;

    // Check memory cache
    const cached = this.memoryCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    // Check localStorage
    if (config.strategy === 'hybrid' || config.strategy === 'localStorage') {
      const stored = localStorage.getItem(`cache:${url}`);
      if (stored) {
        try {
          const { data, expiresAt } = JSON.parse(stored);
          if (expiresAt > Date.now()) {
            this.memoryCache.set(url, { data, expiresAt });
            return data as T;
          }
        } catch (e) {
          localStorage.removeItem(`cache:${url}`);
        }
      }
    }

    return null;
  }

  set<T>(url: string, data: T): void {
    const config = this.getCacheConfig(url);
    if (config.ttl === 0) return;

    const expiresAt = Date.now() + config.ttl;

    // Store in memory
    this.memoryCache.set(url, { data, expiresAt });

    // Store in localStorage
    if (config.strategy === 'hybrid' || config.strategy === 'localStorage') {
      try {
        localStorage.setItem(
          `cache:${url}`,
          JSON.stringify({ data, expiresAt })
        );
      } catch (e) {
        console.warn('Failed to cache to localStorage:', e);
      }
    }
  }

  invalidate(pattern: string): void {
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache:') && key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('cache:')) {
        localStorage.removeItem(key);
      }
    }
  }
}

export const cacheManager = new CacheManager();
```

### Integration with API Client

```typescript
// frontend/src/api/client.ts
import { cacheManager } from '@/lib/cacheManager';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Check cache for GET requests
  if (!init || init.method === 'GET') {
    const cached = await cacheManager.get<T>(path);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await fetch(path, init);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Cache successful GET requests
    if (!init || init.method === 'GET') {
      cacheManager.set(path, data);
    }

    return data as T;
  } catch (error) {
    // Try to return stale cache on error
    if (!init || init.method === 'GET') {
      const stale = await cacheManager.get<T>(path);
      if (stale) {
        console.warn(`Using stale cache for ${path}`);
        return stale;
      }
    }
    throw error;
  }
}

// Invalidate cache on mutations
export const clientsApi = {
  list: () => request('/api/v1/clients'),
  create: async (data: any) => {
    const result = await request('/api/v1/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    cacheManager.invalidate('/api/v1/clients');
    return result;
  },
  update: async (id: string, data: any) => {
    const result = await request(`/api/v1/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    cacheManager.invalidate('/api/v1/clients');
    return result;
  },
  delete: async (id: string) => {
    const result = await request(`/api/v1/clients/${id}`, {
      method: 'DELETE',
    });
    cacheManager.invalidate('/api/v1/clients');
    return result;
  },
};
```

### Cache Hit Metrics

```typescript
// frontend/src/lib/analytics.ts
export class CacheAnalytics {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
    this.logStats();
  }

  recordMiss(): void {
    this.misses++;
    this.logStats();
  }

  private logStats(): void {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : 0;
    console.log(`Cache Hit Rate: ${hitRate}% (${this.hits}/${total})`);
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100) : 0,
    };
  }
}

export const cacheAnalytics = new CacheAnalytics();
```

---

## 5. Network Optimization

### HTTP/2 Server Push
```typescript
// backend/next.config.ts
export default {
  headers: async () => {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Link',
            value: '</main.js>; rel=preload; as=script, </styles.css>; rel=preload; as=style',
          },
        ],
      },
    ];
  },
};
```

### Resource Prefetching
```typescript
// frontend/src/components/Link.tsx
import { Link as RouterLink } from 'react-router-dom';
import { useEffect } from 'react';

export function PrefetchLink({ to, children, ...props }: any) {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = `/routes/${to}.js`;
    document.head.appendChild(link);
  }, [to]);

  return <RouterLink to={to} {...props}>{children}</RouterLink>;
}
```

---

## 6. Image Optimization

```typescript
// frontend/src/components/OptimizedImage.tsx
import { useState } from 'react';

export function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height,
  ...props 
}: any) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      style={{
        opacity: loaded ? 1 : 0.5,
        transition: 'opacity 0.3s',
      }}
      {...props}
    />
  );
}
```

---

## 7. Performance Monitoring

```typescript
// frontend/src/lib/performanceMonitor.ts
export class PerformanceMonitor {
  measure(label: string, callback: () => void): number {
    const start = performance.now();
    callback();
    const end = performance.now();
    const duration = end - start;

    if (duration > 100) {
      console.warn(`Slow operation: ${label} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  async measureAsync<T>(
    label: string,
    callback: () => Promise<T>
  ): Promise<[T, number]> {
    const start = performance.now();
    const result = await callback();
    const end = performance.now();
    const duration = end - start;

    if (duration > 100) {
      console.warn(`Slow operation: ${label} took ${duration.toFixed(2)}ms`);
    }

    return [result, duration];
  }

  getMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domInteractive: navigation.domInteractive,
      domComplete: navigation.domComplete,
      loadComplete: navigation.loadEventEnd,
    };
  }
}

export const perfMonitor = new PerformanceMonitor();
```

---

## 8. Optimization Checklist

- [ ] Implement code splitting for all routes
- [ ] Lazy load heavy components
- [ ] Add virtualization to large lists (tables, grids)
- [ ] Implement multi-layer caching strategy
- [ ] Enable gzip compression
- [ ] Optimize images (WebP, responsive sizes)
- [ ] Remove unused dependencies
- [ ] Tree-shake unused exports
- [ ] Enable HTTP/2 server push
- [ ] Implement performance monitoring

---

## 9. Expected Performance Improvements

| Optimization | Impact | Priority |
|---|---|---|
| Code Splitting | 70% faster initial load | High |
| Virtualization | 80% faster list rendering | High |
| Caching | 60-80% API hit rate | High |
| Image Optimization | 40% smaller images | Medium |
| Tree-shaking | 20% bundle reduction | Medium |

---

## 10. Monitoring & Alerts

Monitor these metrics:
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms
- **Time to Interactive (TTI)**: < 3.5s
- **Bundle Size**: < 800 KB gzipped

