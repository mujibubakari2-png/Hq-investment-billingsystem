import { useSyncExternalStore } from 'react';

// ── Simple auth state store (no external dependencies needed) ───────────────

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    role: string;
    phone?: string;
    fullName?: string;
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
// The token is stored in HttpOnly cookies (server-side verification).
// localStorage only stores the user profile for UI display.
// If someone injects a fake user, the first API call returns 401 → logout.
function loadState(): AuthState {
    const userJson = safeGetItem('user');
    let user: AuthUser | null = null;

    if (userJson) {
        try {
            user = JSON.parse(userJson);
        } catch {
            user = null;
        }
    }

    return {
        token: null, // Token handled via cookies
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
    state = { token, user, isAuthenticated: true };
    notify();
}

function logout() {
    safeRemoveItem('user');
    state = { token: null, user: null, isAuthenticated: false };
    notify();
}

/** Update the current user in-place (e.g. after profile edit) */
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
    subscribe,
    login,
    logout,
    updateUser,
    useAuth,
};

export default authStore;
