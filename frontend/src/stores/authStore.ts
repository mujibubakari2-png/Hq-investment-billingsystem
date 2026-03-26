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

// Read initial state from localStorage
function loadState(): AuthState {
    const token = localStorage.getItem('token');
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
        token,
        user,
        isAuthenticated: !!token && !!user,
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
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    state = { token, user, isAuthenticated: true };
    notify();
}

function logout() {
    localStorage.removeItem('token');
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
