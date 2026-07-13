// ── Shared HTTP client ────────────────────────────────────────────────────────
// All API modules import from here. Never import directly in page components.

import authStore from '../stores/authStore';

const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';
export const CLEAN_API_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
const BASE = `${CLEAN_API_URL}/api`;

let memoryCsrfToken: string | null = null;

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    // 1. Authorization header from stored token (cross-port dev + mobile clients)
    //    The backend checks cookies first, then falls back to this header.
    //    This ensures 401s don't happen when SameSite cookie policy blocks cross-port delivery.
    const token = authStore.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    // 2. CSRF token from non-HttpOnly cookie (must be sent as a header)
    const csrfToken = getCookie('csrf-token') || memoryCsrfToken;
    if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
    }
    return headers;
}

// Fetch CSRF token explicitly for cold starts
let csrfFetchPromise: Promise<string | null> | null = null;
async function fetchCsrfToken(): Promise<string | null> {
    if (csrfFetchPromise) return csrfFetchPromise;
    csrfFetchPromise = (async () => {
        try {
            const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
            const token = res.headers.get('x-csrf-token');
            if (token) {
                memoryCsrfToken = token;
            }
            return memoryCsrfToken;
        } catch {
            return null;
        } finally {
            csrfFetchPromise = null;
        }
    })();
    return csrfFetchPromise;
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
            headers: authHeaders(),
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
        try { authStore.logout(); } catch { /* ignore */ }
        // E18 FIX: Use the correct basename
        window.location.href = '/billing/login';
    }
    throw new Error('Unauthorized');
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const fullUrl = `${BASE}${path}`;
    
    // Intercept non-GET requests to ensure we have a CSRF token
    const method = init?.method || 'GET';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        if (!getCookie('csrf-token') && !memoryCsrfToken) {
            await fetchCsrfToken();
        }
    }

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

        // Always check if the response attached a fresh CSRF token
        const resCsrfToken = res.headers.get('x-csrf-token');
        if (resCsrfToken) {
            memoryCsrfToken = resCsrfToken;
        }

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

/**
 * Fetch a non-JSON file response (e.g. the generated .rsc router script) with
 * the same auth/CSRF/refresh handling as request(), and trigger a browser
 * download. Use this instead of generating security-sensitive config
 * client-side — the backend is the single source of truth for router
 * provisioning scripts (credentials never need to touch browser JS this way).
 */
export async function downloadFile(path: string, suggestedFilename?: string): Promise<void> {
    const fullUrl = `${BASE}${path}`;

    let res = await fetch(fullUrl, {
        credentials: 'include',
        headers: { ...authHeaders() },
    });

    if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
            res = await fetch(fullUrl, {
                credentials: 'include',
                headers: { ...authHeaders() },
            });
        }
        if (res.status === 401) forceLogout();
    }

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const data = await res.json();
            message = data?.error || data?.message || message;
        } catch { /* not JSON, keep default message */ }
        throw new Error(message);
    }

    const blob = await res.blob();
    const contentDisposition = res.headers.get('content-disposition') || '';
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    const filename = suggestedFilename || match?.[1] || 'download.txt';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
