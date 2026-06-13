/**
 * Global test setup — runs before every test file.
 * Imports jest-dom matchers (toBeInTheDocument, toHaveValue, etc.)
 * and installs global afterEach cleanup for RTL.
 */
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Automatically unmount components + clear JSDOM after each test
afterEach(() => {
    cleanup();
});

// ── Global browser API stubs (jsdom doesn't ship these) ──────────────────────

// matchMedia (used by MUI / responsive hooks)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// ResizeObserver (used by some chart/grid components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// URL.createObjectURL (used by file download handlers)
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
global.URL.revokeObjectURL = vi.fn();

// scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
