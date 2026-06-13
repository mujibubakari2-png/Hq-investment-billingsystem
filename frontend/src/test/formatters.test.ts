/**
 * formatters utility tests
 * Tests: formatDate, formatDateTime, formatDateForInput, formatExactDate,
 *        toTimestamp, formatCurrency, formatPhone, generatePassword
 */
import { describe, it, expect } from 'vitest';
import {
    formatDate, formatDateTime, formatDateForInput,
    formatExactDate, toTimestamp, formatCurrency,
    formatPhone, generatePassword,
} from '../utils/formatters';


// Fixed ISO date used across tests
const ISO = '2024-06-15T10:30:00.000Z';

describe('formatDate', () => {
    it('returns a human-readable date string from ISO input', () => {
        const result = formatDate(ISO);
        expect(result).toMatch(/\d{4}/);      // contains year
        expect(result).not.toBe('N/A');
    });

    it('returns N/A for null', () => {
        expect(formatDate(null)).toBe('N/A');
    });

    it('returns N/A for empty string', () => {
        expect(formatDate('')).toBe('N/A');
    });

    it('returns N/A for "N/A" string', () => {
        expect(formatDate('N/A')).toBe('N/A');
    });

    it('returns N/A for "Invalid Date" string', () => {
        expect(formatDate('Invalid Date')).toBe('N/A');
    });

    it('returns N/A for garbage string', () => {
        expect(formatDate('not-a-date')).toBe('N/A');
    });

    it('accepts a Date object', () => {
        expect(formatDate(new Date(ISO))).not.toBe('N/A');
    });

    it('accepts a numeric timestamp', () => {
        expect(formatDate(Date.parse(ISO))).not.toBe('N/A');
    });
});

describe('formatDateTime', () => {
    it('returns date and time from ISO input', () => {
        const result = formatDateTime(ISO);
        expect(result).not.toBe('N/A');
        expect(result.length).toBeGreaterThan(10);
    });

    it('returns N/A for null', () => {
        expect(formatDateTime(null)).toBe('N/A');
    });
});

describe('formatDateForInput', () => {
    it('returns YYYY-MM-DD format', () => {
        const result = formatDateForInput(ISO);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns empty string for invalid date', () => {
        expect(formatDateForInput(null)).toBe('');
        expect(formatDateForInput('garbage')).toBe('');
    });
});

describe('formatExactDate', () => {
    it('returns DD/MM/YYYY HH:mm format', () => {
        const result = formatExactDate(ISO);
        expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('returns N/A for null', () => {
        expect(formatExactDate(null)).toBe('N/A');
    });
});

describe('toTimestamp', () => {
    it('returns numeric timestamp for valid date', () => {
        const ts = toTimestamp(ISO);
        expect(typeof ts).toBe('number');
        expect(ts).toBeGreaterThan(0);
    });

    it('returns 0 for invalid date', () => {
        expect(toTimestamp(null)).toBe(0);
        expect(toTimestamp('garbage')).toBe(0);
    });
});

describe('formatCurrency', () => {
    it('formats amount with TZS prefix', () => {
        const result = formatCurrency(10000);
        expect(result).toMatch(/TZS/);
        expect(result).toMatch(/10/);
    });

    it('formats 0 correctly', () => {
        const result = formatCurrency(0);
        expect(result).toMatch(/TZS/);
    });

    it('formats large numbers without decimals', () => {
        const result = formatCurrency(1500000);
        expect(result).not.toContain('.');
    });
});

describe('formatPhone', () => {
    it('prepends + to 255-prefixed numbers', () => {
        expect(formatPhone('255712345678')).toBe('+255712345678');
    });

    it('leaves non-255 numbers unchanged', () => {
        expect(formatPhone('0712345678')).toBe('0712345678');
    });
});

describe('generatePassword', () => {
    it('returns a string of the correct length', () => {
        const pw = generatePassword(12);
        expect(pw).toHaveLength(12);
    });

    it('defaults to 8 characters', () => {
        const pw = generatePassword();
        expect(pw).toHaveLength(8);
    });

    it('only contains alphanumeric characters', () => {
        const pw = generatePassword(32);
        expect(pw).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('generates different passwords each call', () => {
        const a = generatePassword(16);
        const b = generatePassword(16);
        // Probability of collision is astronomically low
        expect(a).not.toBe(b);
    });
});
