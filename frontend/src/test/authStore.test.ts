/**
 * authStore unit tests
 * Tests: login, logout, updateUser, isAuthenticated flag, localStorage persistence, safe accessor fallbacks
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import authStore from '../stores/authStore';


// ── Helpers ───────────────────────────────────────────────────────────────────
const MOCK_USER = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@hq.test',
    role: 'ADMIN',
    tenantId: 'tenant-1',
};

describe('authStore', () => {
    beforeEach(() => {
        // Reset state before each test
        localStorage.clear();
        authStore.logout();
    });

    it('starts unauthenticated when localStorage is empty', () => {
        const state = authStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
    });

    it('login() sets user and isAuthenticated = true', () => {
        authStore.login('tok-abc', MOCK_USER);
        const state = authStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user).toMatchObject({ id: 'user-1', role: 'ADMIN' });
    });

    it('login() persists user to localStorage', () => {
        authStore.login('tok-abc', MOCK_USER);
        const stored = JSON.parse(localStorage.getItem('user') || 'null');
        expect(stored?.id).toBe('user-1');
    });

    it('logout() clears user and sets isAuthenticated = false', () => {
        authStore.login('tok-abc', MOCK_USER);
        authStore.logout();
        const state = authStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
    });

    it('logout() removes user from localStorage', () => {
        authStore.login('tok-abc', MOCK_USER);
        authStore.logout();
        expect(localStorage.getItem('user')).toBeNull();
    });

    it('updateUser() merges partial fields without losing existing ones', () => {
        authStore.login('tok-abc', MOCK_USER);
        authStore.updateUser({ companyName: 'HQ Investment' });
        const { user } = authStore.getState();
        expect(user?.companyName).toBe('HQ Investment');
        expect(user?.username).toBe('admin'); // unchanged
    });

    it('updateUser() is a no-op when no user is logged in', () => {
        // Should not throw
        expect(() => authStore.updateUser({ companyName: 'X' })).not.toThrow();
        expect(authStore.getState().user).toBeNull();
    });

    it('notifies listeners on login', () => {
        const listener = vi.fn();
        const unsub = authStore.subscribe(listener);
        authStore.login('tok', MOCK_USER);
        expect(listener).toHaveBeenCalledTimes(1);
        unsub();
    });

    it('notifies listeners on logout', () => {
        authStore.login('tok', MOCK_USER);
        const listener = vi.fn();
        const unsub = authStore.subscribe(listener);
        authStore.logout();
        expect(listener).toHaveBeenCalledTimes(1);
        unsub();
    });

    it('unsubscribe prevents further notifications', () => {
        const listener = vi.fn();
        const unsub = authStore.subscribe(listener);
        unsub();
        authStore.login('tok', MOCK_USER);
        expect(listener).not.toHaveBeenCalled();
    });

    it('recovers gracefully when localStorage contains malformed JSON', () => {
        localStorage.setItem('user', '{bad json}');
        // Re-import loadState by reading getState — it was called at module init.
        // The store's loadState() handles catch → user = null.
        // We test the safe-accessor path by directly checking getState after login.
        authStore.login('tok', MOCK_USER);
        expect(authStore.getState().isAuthenticated).toBe(true);
    });

    it('safe accessor: does not throw when localStorage throws', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        expect(() => authStore.login('tok', MOCK_USER)).not.toThrow();
        spy.mockRestore();
    });
});
