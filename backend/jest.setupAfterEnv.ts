/// <reference types="jest" />
import { jest } from '@jest/globals';
import { disconnectPrismaClient } from '@/lib/prisma';
import { closeCache } from '@/lib/cache';

declare const beforeAll: (fn: () => void | Promise<void>) => void;
declare const afterAll: (fn: () => void | Promise<void>) => void;

// Suppress console.error and console.warn in tests to keep CI logs clean.
// Many tests intentionally trigger error paths (e.g. simulating network timeouts)
// which print scary red errors to the console even though the test PASSES.
beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
});

afterAll(async () => {
    jest.restoreAllMocks();
    try {
        await disconnectPrismaClient();
    } catch {
        // Ignore disconnect errors during test teardown.
    }

    try {
        await closeCache();
    } catch {
        // Ignore cache shutdown errors during test teardown.
    }
});
