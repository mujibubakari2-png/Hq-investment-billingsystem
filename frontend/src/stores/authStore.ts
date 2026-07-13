import { useSyncExternalStore } from 'react';

// ── Simple auth state store (no external dependencies needed) ───────────────

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    role: string;
    phone?: string;
    fullName?: string;
    tenantId?: string | null;
    // BRAND-001: Tenant branding fields — set at login/register, used throughout UI
    // so we never need a separate settings API call just to show the company name.
    companyName?: string | null;
    companyLogo?: string | null;
    companyEmail?: string | null;
    tenantSlug?: string | null;
    isPlatformAdmin?: boolean;
}

export interface AuthState {
    token: string | null;
    user: AuthUser | null;
    isAuthenticated: boolean;
}

// Bug #14 FIX: Safe localStorage wrapper — prevents crashes in incognito mode,
// when storage is full, or when localStorage is disabled by browser policy.
function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage full or unavailable — silently ignore
    }
}

function safeRemoveItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // Storage unavailable — silently ignore
    }
}

// SEC-C1 FIX: Token is NO LONGER persisted in localStorage.
// Persisting JWT in localStorage exposes it to XSS attacks — any injected script
// on the page can read localStorage and steal the session token.
//
// Token lifecycle:
//   - Set in-memory (state.token) at login time.
//   - Used by httpClient for Authorization header during the active browser tab session.
//   - Cleared automatically when the tab is closed or the user logs out.
//   - After page reload: state.token is null → Authorization header not sent →
//     the backend falls back to the HttpOnly auth cookie automatically.
//
// User profile data (name, role, tenant) is still stored in localStorage so the
// UI can restore itself after a page reload without an extra round-trip.
function loadState(): AuthState {
    const userJson = safeGetItem('user');
    // SEC-C1: Token intentionally NOT read from localStorage — cookie handles auth after reload.
    let user: AuthUser | null = null;

    if (userJson) {
        try {
            user = JSON.parse(userJson);
        } catch {
            user = null;
        }
    }

    return {
        token: null, // In-memory only; populated at login. Cookies handle auth on reload.
        user,
        isAuthenticated: !!user,
    };
}

let state: AuthState = loadState();
const listeners: Array<(s: AuthState) => void> = [];

function notify() {
    listeners.forEach((fn) => fn(state));
}

function subscribe(fn: (s: AuthState) => void) {
    listeners.push(fn);
    return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
    };
}

function getState(): AuthState {
    return state;
}

function login(token: string, user: AuthUser) {
    safeSetItem('user', JSON.stringify(user));
    // SEC-C1: Token stored in-memory ONLY — never persisted to localStorage.
    // The HttpOnly auth cookie is the durable credential. This in-memory token
    // is kept so the Authorization header works during the current tab session
    // (useful for cross-port dev and API clients) without creating an XSS attack surface.
    state = { token, user, isAuthenticated: true };
    notify();
}

function logout() {
    safeRemoveItem('user');
    // No safeRemoveItem('token') — token was never stored in localStorage.
    state = { token: null, user: null, isAuthenticated: false };
    notify();
}

/** Update the current user in-place (e.g. after profile edit or branding update) */
function updateUser(partial: Partial<AuthUser>) {
    if (!state.user) return;
    const updated = { ...state.user, ...partial };
    safeSetItem('user', JSON.stringify(updated));
    state = { ...state, user: updated };
    notify();
}

/** React hook – call inside a component to re-render on auth changes */
export function useAuth(): AuthState {
    return useSyncExternalStore(subscribe, getState);
}

export const authStore = {
    getState,
    // SEC-C1: Returns in-memory token only. Returns null after page reload;
    // httpClient will then rely on the HttpOnly auth cookie automatically.
    getToken: () => state.token,
    subscribe,
    login,
    logout,
    updateUser,
    useAuth,
};

export default authStore;
