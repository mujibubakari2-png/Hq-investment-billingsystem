import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
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

// ── App Root ──────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <GoogleOAuthWrapper>
          <App />
        </GoogleOAuthWrapper>
      </ErrorBoundary>
      {/* DevTools only loaded in development (tree-shaken in production build) */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  </StrictMode>
);
