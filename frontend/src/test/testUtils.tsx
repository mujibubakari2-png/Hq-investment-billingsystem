/**
 * Shared test utilities: typed render wrapper, mock factories, API stub helpers.
 */
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// ── Providers wrapper ─────────────────────────────────────────────────────────
interface WrapperOptions extends RenderOptions {
    routerProps?: MemoryRouterProps;
}

/**
 * renderWithProviders — wraps component with React Router + TanStack Query.
 * Use this for any component that calls useNavigate / useQuery / useMutation.
 */
export function renderWithProviders(
    ui: React.ReactElement,
    { routerProps, ...renderOptions }: WrapperOptions = {},
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries:  { retry: false },
            mutations: { retry: false },
        },
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter {...routerProps}>
                    {children}
                </MemoryRouter>
            </QueryClientProvider>
        );
    }

    return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// ── Mock factories ────────────────────────────────────────────────────────────

export function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'user-1',
        username: 'testadmin',
        email: 'admin@hq.test',
        role: 'ADMIN',
        tenantId: 'tenant-1',
        phone: '0700000000',
        createdAt: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

export function makeRouter(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'router-1',
        name: 'Test Router',
        host: '192.168.1.1',
        port: 8728,
        username: 'admin',
        status: 'Online',
        tenantId: 'tenant-1',
        createdAt: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

export function makePackage(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'pkg-1',
        name: 'Basic 1 Day',
        price: 1000,
        duration: 1,
        durationUnit: 'day',
        validity: '1 day',
        bandwidth: '5Mbps',
        status: 'Active',
        routerId: 'router-1',
        tenantId: 'tenant-1',
        createdAt: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

export function makeSubscription(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'sub-1',
        clientId: 'client-1',
        packageId: 'pkg-1',
        routerId: 'router-1',
        status: 'Active',
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        createdAt: '2024-01-01T00:00:00Z',
        tenantId: 'tenant-1',
        ...overrides,
    };
}

// ── API mock helper ───────────────────────────────────────────────────────────

/** Creates a resolved-promise mock for an API function */
export function mockResolve<T>(data: T) {
    return vi.fn().mockResolvedValue(data);
}

/** Creates a rejected-promise mock for an API function */
export const mockReject = (msg = 'API error') =>
    vi.fn().mockRejectedValue(new Error(msg));
