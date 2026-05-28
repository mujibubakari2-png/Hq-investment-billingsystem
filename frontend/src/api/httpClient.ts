// ── Shared HTTP client ────────────────────────────────────────────────────────
// All API modules import from here. Never import directly in page components.

const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';
export const CLEAN_API_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
const BASE = `${CLEAN_API_URL}/api`;

function authHeaders(): Record<string, string> {
    // If you're keeping a short-lived token in memory or fallback, use it.
    // Otherwise, relying on HttpOnly cookie means we might not need this header.
    // For now we will keep it if it exists in authStore (or localStorage if we didn't remove it).
    // The instructions say "Update headers to rely on HttpOnly cookies instead of localStorage"
    return {};
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

        if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
            try {
                const refreshRes = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    if (refreshData.token) {
                        // Retry original request
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
                }
            } catch (err) {
                console.error("Token refresh failed", err);
            }

            if (typeof window !== 'undefined') {
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
            throw new Error('Unauthorized');
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
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

export const get   = <T>(path: string)                    => request<T>(path);
export const post  = <T>(path: string, body: unknown)     => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put   = <T>(path: string, body: unknown)     => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown)     => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del   = <T>(path: string)                    => request<T>(path, { method: 'DELETE' });
