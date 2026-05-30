// ── Shared HTTP client ────────────────────────────────────────────────────────
// All API modules import from here. Never import directly in page components.

const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';
export const CLEAN_API_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
const BASE = `${CLEAN_API_URL}/api`;

function authHeaders(): Record<string, string> {
    // Auth token is stored in HttpOnly cookies — no manual header needed.
    return {};
}

// Bug #7 FIX: Mutex to prevent multiple concurrent refresh attempts.
// When several requests get 401 at the same time, only the first one
// triggers a refresh. Others wait for the result and then retry.
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
    try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
        });
        if (refreshRes.ok) {
            const data = await refreshRes.json();
            return !!data.token;
        }
        return false;
    } catch {
        return false;
    }
}

async function refreshToken(): Promise<boolean> {
    // If a refresh is already in progress, wait for it instead of starting another
    if (refreshPromise) {
        return refreshPromise;
    }
    refreshPromise = doRefresh();
    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

function forceLogout(): never {
    if (typeof window !== 'undefined') {
        try { localStorage.removeItem('user'); } catch { /* ignore */ }
        window.location.href = '/login';
    }
    throw new Error('Unauthorized');
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const fullUrl = `${BASE}${path}`;
    try {
        const res = await fetch(fullUrl, {
            ...init,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders(),
                ...(init?.headers as Record<string, string>),
            },
        });

        // Bug #7 FIX: On 401, attempt a single mutex-guarded refresh then retry once.
        if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
            const refreshed = await refreshToken();
            if (refreshed) {
                // Retry the original request exactly once
                const retryRes = await fetch(fullUrl, {
                    ...init,
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(),
                        ...(init?.headers as Record<string, string>),
                    },
                });
                if (retryRes.ok) {
                    return await retryRes.json() as T;
                }
            }
            // Refresh failed or retry failed — force logout
            forceLogout();
        }

        // Safely parse JSON — handle non-JSON responses (e.g., nginx HTML error pages)
        let data: any;
        try {
            data = await res.json();
        } catch {
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
        if (!res.ok) throw new Error(data?.error || data?.message || 'Request failed');
        return data as T;
    } catch (error: unknown) {
        const err = error as Error;
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error(
                `Unable to connect to the server at ${fullUrl}. ` +
                `Check your internet connection or ensure VITE_API_URL is correctly set.`
            );
        }
        throw error;
    }
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });
