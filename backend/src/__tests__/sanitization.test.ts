/**
 * Sanitization utility unit tests
 * Tests: sanitizeHtml, escapeHtml, sanitizeFilename, sanitizeEmail,
 *        sanitizeUrl, sanitizePhoneNumber, sanitizeUsername,
 *        sanitizePaginationParams, sanitizeDateInput
 */

import {
    sanitizeHtml, escapeHtml, sanitizeFilename,
    sanitizeEmail, sanitizeUrl, sanitizePhoneNumber,
    sanitizeUsername, sanitizePaginationParams, sanitizeDateInput,
} from '../lib/sanitization';

// â”€â”€ sanitizeHtml â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizeHtml', () => {
    it('removes <script> tags', () => {
        const result = sanitizeHtml('<p>Hello</p><script>alert(1)</script>');
        expect(result).not.toContain('<script>');
        expect(result).toBe('Hello');
    });

    it('removes inline event handlers', () => {
        const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
        expect(result).not.toContain('onerror');
    });

    it('removes <iframe> tags', () => {
        const result = sanitizeHtml('<iframe src="evil.com"></iframe>');
        expect(result).not.toContain('iframe');
    });

    it('removes <form> tags', () => {
        const result = sanitizeHtml('<form action="steal.php"><input></form>');
        expect(result).not.toContain('<form');
    });

    it('strips all HTML tags including previously safe ones', () => {
        const safe = '<b>bold</b> and <i>italic</i>';
        expect(sanitizeHtml(safe)).toBe('bold and italic');
    });

    it('returns empty string for empty input', () => {
        expect(sanitizeHtml('')).toBe('');
    });
});

// â”€â”€ escapeHtml â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('escapeHtml', () => {
    it('escapes & < > " and single quote', () => {
        expect(escapeHtml('&')).toBe('&amp;');
        expect(escapeHtml('<')).toBe('&lt;');
        expect(escapeHtml('>')).toBe('&gt;');
        expect(escapeHtml('"')).toBe('&quot;');
        expect(escapeHtml("'")).toBe('&#039;');
    });

    it('escapes a combined XSS payload', () => {
        const result = escapeHtml('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    it('leaves safe text untouched', () => {
        expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });

    it('returns empty string for empty input', () => {
        expect(escapeHtml('')).toBe('');
    });
});

// â”€â”€ sanitizeFilename â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizeFilename', () => {
    it('removes path separators', () => {
        expect(sanitizeFilename('../../../etc/passwd')).not.toContain('/');
        expect(sanitizeFilename('C:\\windows\\system32')).not.toContain('\\');
    });

    it('removes dangerous chars < > : " | ? *', () => {
        const result = sanitizeFilename('file<>:"|?*.txt');
        expect(result).not.toMatch(/[<>:"|?*]/);
    });

    it('trims leading/trailing dots and spaces', () => {
        expect(sanitizeFilename('  .hidden. ')).toBe('hidden');
    });

    it('truncates to 255 characters', () => {
        const long = 'a'.repeat(300);
        expect(sanitizeFilename(long)).toHaveLength(255);
    });

    it('returns "file" for empty input', () => {
        expect(sanitizeFilename('')).toBe('file');
    });

    it('returns "file" when result is empty after sanitization', () => {
        expect(sanitizeFilename('...')).toBe('file');
    });
});

// â”€â”€ sanitizeEmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizeEmail', () => {
    it('lowercases and trims valid email', () => {
        expect(sanitizeEmail('  Admin@HQ.Test  ')).toBe('admin@hq.test');
    });

    it('returns valid email unchanged (after trim/lower)', () => {
        expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
    });

    it('returns empty string for invalid email', () => {
        expect(sanitizeEmail('notanemail')).toBe('');
    });

    it('returns empty string for empty input', () => {
        expect(sanitizeEmail('')).toBe('');
    });

    it('strips < > from input and returns valid result if email survives', () => {
        // sanitizeEmail strips < > ' " then validates
        // '<admin>@example.com' → 'admin@example.com' → valid
        expect(sanitizeEmail('<admin>@example.com')).toBe('admin@example.com');
    });

    it('returns empty string when stripped value is not a valid email', () => {
        // "<<>>" stripped → "" → fails regex → ''
        expect(sanitizeEmail('<<<<>>>>')).toBe('');
    });
});

// ————————————————————————————————————————————————————————————————————————————————
describe('sanitizeUrl', () => {
    it('blocks javascript: protocol', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('/');
    });

    it('blocks data: protocol', () => {
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('/');
    });

    it('prepends / to relative paths without a leading slash', () => {
        const result = sanitizeUrl('dashboard');
        expect(result).toMatch(/^\/dashboard/);
    });

    it('returns / for empty string', () => {
        expect(sanitizeUrl('')).toBe('/');
    });

    it('returns path from absolute URL', () => {
        const result = sanitizeUrl('http://localhost/admin?tab=1');
        expect(result).toBe('/admin?tab=1');
    });
});

// â”€â”€ sanitizePhoneNumber â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizePhoneNumber', () => {
    it('removes characters other than digits, +, -, space, ()', () => {
        expect(sanitizePhoneNumber('0712<XSS>345678')).toBe('0712345678');
    });

    it('preserves + prefix', () => {
        expect(sanitizePhoneNumber('+255712345678')).toBe('+255712345678');
    });

    it('truncates to 20 characters', () => {
        const long = '1234567890'.repeat(3);
        expect(sanitizePhoneNumber(long).length).toBeLessThanOrEqual(20);
    });

    it('returns empty string for empty input', () => {
        expect(sanitizePhoneNumber('')).toBe('');
    });
});

// â”€â”€ sanitizeUsername â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizeUsername', () => {
    it('lowercases and strips invalid chars', () => {
        expect(sanitizeUsername('Admin@123!')).toBe('admin123');
    });

    it('prepends _ if username starts with a digit', () => {
        const result = sanitizeUsername('123admin');
        expect(result).toMatch(/^_/);
    });

    it('returns empty string for input shorter than 3 chars', () => {
        expect(sanitizeUsername('ab')).toBe('');
    });

    it('truncates to 30 characters', () => {
        const long = 'abcdefghij'.repeat(4); // 40 chars
        expect(sanitizeUsername(long)).toHaveLength(30);
    });

    it('returns empty string for empty input', () => {
        expect(sanitizeUsername('')).toBe('');
    });

    it('preserves underscores and hyphens', () => {
        expect(sanitizeUsername('my_user-name')).toBe('my_user-name');
    });
});

// â”€â”€ sanitizePaginationParams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizePaginationParams', () => {
    it('returns defaults when no params given', () => {
        expect(sanitizePaginationParams()).toEqual({ page: 1, limit: 10 });
    });

    it('clamps page to minimum 1', () => {
        expect(sanitizePaginationParams('0', '10')).toEqual({ page: 1, limit: 10 });
        expect(sanitizePaginationParams('-5', '10')).toEqual({ page: 1, limit: 10 });
    });

    it('clamps limit to maximum 100', () => {
        expect(sanitizePaginationParams('1', '999')).toEqual({ page: 1, limit: 100 });
    });

    it('clamps page to maximum 1000', () => {
        expect(sanitizePaginationParams('9999', '10')).toEqual({ page: 1000, limit: 10 });
    });

    it('parses string numbers correctly', () => {
        expect(sanitizePaginationParams('3', '25')).toEqual({ page: 3, limit: 25 });
    });

    it('handles non-numeric strings gracefully', () => {
        expect(sanitizePaginationParams('abc', 'xyz')).toEqual({ page: 1, limit: 10 });
    });
});

// â”€â”€ sanitizeDateInput â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe('sanitizeDateInput', () => {
    it('returns ISO string for valid date', () => {
        const result = sanitizeDateInput('2024-06-15');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns null for empty string', () => {
        expect(sanitizeDateInput('')).toBeNull();
    });

    it('returns null for invalid date', () => {
        expect(sanitizeDateInput('not-a-date')).toBeNull();
    });

    it('returns null for "undefined" string', () => {
        expect(sanitizeDateInput('undefined')).toBeNull();
    });
});
