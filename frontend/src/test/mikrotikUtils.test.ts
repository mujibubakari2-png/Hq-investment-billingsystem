/**
 * mikrotikUtils unit tests
 * Tests: sanitizeMikroTikName — covers all transformation rules
 */
import { describe, it, expect } from 'vitest';
import { sanitizeMikroTikName } from '../utils/mikrotikUtils';


describe('sanitizeMikroTikName', () => {
    // ── Basic happy path ─────────────────────────────────────────────────────
    it('lowercases the name', () => {
        expect(sanitizeMikroTikName('MyRouter')).toBe('myrouter');
    });

    it('replaces spaces with hyphens', () => {
        expect(sanitizeMikroTikName('My Router')).toBe('my-router');
    });

    it('collapses multiple spaces into one hyphen', () => {
        expect(sanitizeMikroTikName('My   Router')).toBe('my-router');
    });

    it('removes special characters', () => {
        expect(sanitizeMikroTikName('Router@Office!')).toBe('routeroffice');
    });

    it('trims leading and trailing whitespace', () => {
        expect(sanitizeMikroTikName('  router  ')).toBe('router');
    });

    it('collapses multiple hyphens', () => {
        expect(sanitizeMikroTikName('my--router')).toBe('my-router');
    });

    it('trims leading and trailing hyphens', () => {
        expect(sanitizeMikroTikName('-router-')).toBe('router');
    });

    // ── Edge cases ───────────────────────────────────────────────────────────
    it('returns "unnamed" for empty string', () => {
        expect(sanitizeMikroTikName('')).toBe('unnamed');
    });

    it('returns "unnamed" for null/undefined-like falsy input', () => {
        // @ts-expect-error testing runtime behaviour with bad input
        expect(sanitizeMikroTikName(null)).toBe('unnamed');
        // @ts-expect-error
        expect(sanitizeMikroTikName(undefined)).toBe('unnamed');
    });

    it('returns "unnamed" when only special chars are given', () => {
        expect(sanitizeMikroTikName('!!!@@@')).toBe('unnamed');
    });

    it('preserves hyphens in middle of name', () => {
        expect(sanitizeMikroTikName('hq-router-01')).toBe('hq-router-01');
    });

    it('handles names with numbers', () => {
        expect(sanitizeMikroTikName('Router 2024')).toBe('router-2024');
    });

    it('handles already-clean lowercase names unchanged', () => {
        expect(sanitizeMikroTikName('myrouter')).toBe('myrouter');
    });

    // ── Real-world ISP router names ───────────────────────────────────────────
    it.each([
        ['HQ Office (Main)',  'hq-office-main'],
        ['Branch #2!',        'branch-2'],
        ['  --MikroTik-- ',   'mikrotik'],
        ['Router A & B',      'router-a-b'],
    ])('sanitizes "%s" → "%s"', (input, expected) => {
        expect(sanitizeMikroTikName(input)).toBe(expected);
    });
});
