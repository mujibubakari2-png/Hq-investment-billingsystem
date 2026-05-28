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

// Helper to check token expiry without a heavy library
function isTokenValid(token: string | null): boolean {
    if (!token) return false;
    try {
        const payloadStr = atob(token.split('.')[1]);
        const payload = JSON.parse(payloadStr);
        if (payload.exp) {
            return payload.exp > Date.now() / 1000;
        }
        return true;
    } catch {
        return false;
    }
}

// Read initial state from localStorage (token should no longer be stored, but we might receive one during login/refresh)
// The token is primarily stored in HttpOnly cookies, so we can ignore token in localStorage.
// However, we still need to manage `isAuthenticated` based on whether we have a valid token (e.g. kept in memory) and user.
// Since HttpOnly cookies are used, on page load we don't have the token.
// The backend needs to provide a way to check if we're authenticated, which `/auth/me` does.
// But for synchronous initial state, if user is in localStorage, we assume they are authenticated until an API call fails.
function loadState(): AuthState {
    const userJson = localStorage.getItem('user');
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
    localStorage.setItem('user', JSON.stringify(user));
    state = { token, user, isAuthenticated: true };
    notify();
}

function logout() {
    localStorage.removeItem('user');
    state = { token: null, user: null, isAuthenticated: false };
    notify();
}

/** Update the current user in-place (e.g. after profile edit) */
function updateUser(partial: Partial<AuthUser>) {
    if (!state.user) return;
    const updated = { ...state.user, ...partial };
    localStorage.setItem('user', JSON.stringify(updated));
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
