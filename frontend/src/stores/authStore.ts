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

// Bug #6 FIX: Read initial state from localStorage with safe accessors.
// The token is stored in both HttpOnly cookies (server-side verification)
// AND localStorage (for Authorization header fallback on cross-port dev requests).
// If someone injects a fake user, the first API call returns 401 → logout.
function loadState(): AuthState {
    const userJson = safeGetItem('user');
    const token    = safeGetItem('token'); // Authorization header fallback
    let user: AuthUser | null = null;

    if (userJson) {
        try {
            user = JSON.parse(userJson);
        } catch {
            user = null;
        }
    }

    return {
        token,
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
    safeSetItem('user',  JSON.stringify(user));
    safeSetItem('token', token); // persist for Authorization header fallback
    state = { token, user, isAuthenticated: true };
    notify();
}

function logout() {
    safeRemoveItem('user');
    safeRemoveItem('token');
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
    getToken: () => state.token ?? safeGetItem('token'), // Authorization header source
    subscribe,
    login,
    logout,
    updateUser,
    useAuth,
};

export default authStore;
