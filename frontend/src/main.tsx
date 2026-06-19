import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import App from './App';

// ── TanStack Query ────────────────────────────────────────────────────────────
// FE-002: Global QueryClient shared across the entire app.
// staleTime: 30s — dashboard/list data is fresh for 30s before a background refetch
// gcTime: 5min — unused queries kept in cache for 5 minutes
// retry: 1 — retry failed requests once before showing an error
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          30_000,  // 30 seconds
      gcTime:          5 * 60_000, // 5 minutes (replaces deprecated cacheTime)
      retry:              1,
      refetchOnWindowFocus: true,  // Refresh data when user tabs back in
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Only initialize Google OAuth when a valid Client ID is provided.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const isGoogleConfigured = !!googleClientId && googleClientId.length > 20;

function GoogleOAuthWrapper({ children }: { children: React.ReactNode }) {
  if (!isGoogleConfigured) return <>{children}</>;
  return <GoogleOAuthProvider clientId={googleClientId!}>{children}</GoogleOAuthProvider>;
}

// ── DevTools (development only) ───────────────────────────────────────────────
// Lazy-loaded so Vite's dead-code elimination removes this entire module from
// the production bundle. `import.meta.env.DEV` is false at production build time,
// so the lazy() call and its import are never evaluated.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : null;

// ── App Root ──────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <GoogleOAuthWrapper>
          <App />
        </GoogleOAuthWrapper>
      </ErrorBoundary>
      {/* DevTools: lazy-loaded in development only — fully tree-shaken in production.
          ReactQueryDevtools is null in production builds (see above). */}
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>
);
