// ── Shared HTTP client ────────────────────────────────────────────────────────
// All API modules import from here. Never import directly in page components.

const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';
export const CLEAN_API_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
const BASE = `${CLEAN_API_URL}/api`;

function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const fullUrl = `${BASE}${path}`;
    try {
        const res = await fetch(fullUrl, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders(),
                ...(init?.headers as Record<string, string>),
            },
        });

        if (res.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
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

export const get  = <T>(path: string)                    => request<T>(path);
export const post = <T>(path: string, body: unknown)     => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put  = <T>(path: string, body: unknown)     => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) });
export const del  = <T>(path: string)                    => request<T>(path, { method: 'DELETE' });
