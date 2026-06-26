/**
 * TanStack Query Hooks
 *
 * FE-002: Centralised server-state hooks for all major data domains.
 * Replace manual useEffect + fetch patterns with these hooks everywhere.
 *
 * Benefits:
 *   - Automatic background refetch on window focus
 *   - Request deduplication (multiple components share one request)
 *   - Optimistic updates + rollback on mutation failure
 *   - DevTools visibility in development
 *
 * Usage:
 *   const { data: clients, isLoading } = useClients({ page: 1, search: 'ali' });
 *   const { data: stats } = useDashboardStats();
 *   const { mutate: createClient } = useCreateClient();
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { get, post, put, del } from './httpClient';

// ── Query Key Factory ─────────────────────────────────────────────────────────
// Centralised keys for cache invalidation — avoids magic strings

export const queryKeys = {
  // Dashboard
  dashboardStats: () => ['dashboard', 'stats'] as const,
  dashboardRecent: () => ['dashboard', 'recent'] as const,

  // Clients
  clients: (params?: object) => ['clients', params] as const,
  client: (id: string) => ['clients', id] as const,

  // Packages
  packages: (params?: object) => ['packages', params] as const,
  package: (id: string) => ['packages', id] as const,

  // Subscriptions
  subscriptions: (params?: object) => ['subscriptions', params] as const,
  subscription: (id: string) => ['subscriptions', id] as const,

  // Routers
  routers: (params?: object) => ['routers', params] as const,
  router: (id: string) => ['routers', id] as const,
  routerSessions: (id: string) => ['routers', id, 'sessions'] as const,
  routerLogs: (id: string) => ['routers', id, 'logs'] as const,

  // Payments / Transactions
  transactions: (params?: object) => ['transactions', params] as const,
  invoices: (params?: object) => ['invoices', params] as const,

  // Users (system users / staff)
  systemUsers: (params?: object) => ['system-users', params] as const,

  // Expired subs
  expiredSubs: (params?: object) => ['expired-subscribers', params] as const,
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useDashboardStats(params?: { tenantId?: string; routerId?: string }) {
  const qs = params
    ? new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== 'All').map(([k, v]) => [k, v as string])
    ).toString()
    : '';
  return useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: () => get<Record<string, unknown>>(`/dashboard${qs ? `?${qs}` : ''}`),
    staleTime: 60_000, // Dashboard stats: 60s (slightly longer — heavy aggregation)
  });
}

// NOTE: /api/dashboard returns all stats in a single call.
// useDashboardRecent is kept for API compatibility but queries the same endpoint.
export function useDashboardRecent() {
  return useQuery({
    queryKey: queryKeys.dashboardRecent(),
    queryFn: () => get<Record<string, unknown>>('/dashboard'),
    staleTime: 30_000,
  });
}

// ── Clients ───────────────────────────────────────────────────────────────────

export interface ClientListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  serviceType?: string;
}

export function useClients(params: ClientListParams = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString();
  return useQuery({
    queryKey: queryKeys.clients(params),
    queryFn: () => get<{ data: unknown[]; total: number; page: number; limit: number }>(`/clients${qs ? `?${qs}` : ''}`),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.client(id),
    queryFn: () => get<Record<string, unknown>>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => post('/clients', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => put(`/clients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: queryKeys.client(id) });
    },
  });
}

export function useDeleteClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// ── Packages ──────────────────────────────────────────────────────────────────

export interface PackageListParams {
  type?: string;
  status?: string;
  routerId?: string;
}

export function usePackages(params: PackageListParams = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString();
  return useQuery({
    queryKey: queryKeys.packages(params),
    queryFn: () => get<unknown[]>(`/packages${qs ? `?${qs}` : ''}`),
    staleTime: 60_000, // Packages rarely change
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => post('/packages', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useUpdatePackage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => put(`/packages/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useDeletePackage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del(`/packages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function useSubscriptions(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString();
  return useQuery({
    queryKey: queryKeys.subscriptions(params),
    queryFn: () => get<unknown[]>(`/subscriptions${qs ? `?${qs}` : ''}`),
  });
}

// ── Routers ───────────────────────────────────────────────────────────────────

export function useRouters(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, v as string])
  ).toString();
  return useQuery({
    queryKey: queryKeys.routers(params),
    queryFn: () => get<unknown[]>(`/routers${qs ? `?${qs}` : ''}`),
    staleTime: 30_000,
  });
}

export function useRouterSessions(routerId: string) {
  return useQuery({
    queryKey: queryKeys.routerSessions(routerId),
    queryFn: () => get<unknown[]>(`/routers/${routerId}/active-sessions`),
    enabled: !!routerId,
    staleTime: 15_000, // Active sessions: shorter stale time
    refetchInterval: 30_000, // Auto-refresh every 30s
  });
}

// ── Transactions / Invoices ───────────────────────────────────────────────────

export function useTransactions(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString();
  return useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => get<unknown[]>(`/transactions${qs ? `?${qs}` : ''}`),
  });
}

export function useInvoices(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString();
  return useQuery({
    queryKey: queryKeys.invoices(params),
    queryFn: () => get<unknown[]>(`/invoices${qs ? `?${qs}` : ''}`),
  });
}

// ── Expired Subscribers ───────────────────────────────────────────────────────

export function useExpiredSubscribers(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  ).toString();
  return useQuery({
    queryKey: queryKeys.expiredSubs(params),
    queryFn: () => get<unknown[]>(`/expired-subscribers${qs ? `?${qs}` : ''}`),
  });
}
