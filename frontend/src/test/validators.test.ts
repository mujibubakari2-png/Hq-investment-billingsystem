/**
 * Validator utility tests
 * Tests: isValidPhone, getPhoneError, isValidEmail, getEmailError
 */
import { describe, it, expect } from 'vitest';
import {
    isValidPhone, getPhoneError,
    isValidEmail, getEmailError,
} from '../utils/validators';


describe('isValidPhone', () => {
    it.each([
        ['255712345678', true],
        ['0712345678',   true],
        ['255612345678', true],
        ['0612345678',   true],
    ])('accepts valid Tanzanian number %s', (phone, expected) => {
        expect(isValidPhone(phone)).toBe(expected);
    });

    it.each([
        ['12345678',          false], // too short, no prefix
        ['712345678',         false], // missing leading 0/255
        ['+255712345678',     false], // plus sign
        ['255712345',         false], // too short
        ['00255712345678',    false], // double zero prefix
        ['',                  false],

    ])('rejects invalid number %s', (phone, expected) => {
        expect(isValidPhone(phone)).toBe(expected);
    });

    it('strips spaces and dashes before validating — "0712 345 678" is valid', () => {
        // The function strips whitespace: '0712 345 678' → '0712345678' (valid)
        expect(isValidPhone('0712 345 678')).toBe(true);
    });

});

describe('getPhoneError', () => {
    it('returns empty string for empty input', () => {
        expect(getPhoneError('')).toBe('');
        expect(getPhoneError('   ')).toBe('');
    });

    it('returns empty string for valid phone', () => {
        expect(getPhoneError('0712345678')).toBe('');
    });

    it('returns error message for invalid phone', () => {
        const err = getPhoneError('123');
        expect(err).toMatch(/invalid phone/i);
    });
});

describe('isValidEmail', () => {
    it.each([
        ['user@example.com',     true],
        ['admin@hq.test',        true],
        ['a+tag@sub.domain.io',  true],
    ])('accepts %s', (email, expected) => {
        expect(isValidEmail(email)).toBe(expected);
    });

    it.each([
        ['notanemail',       false],
        ['@nodomain.com',    false],
        ['user@',           false],
        ['user@domain',     false],
        ['',                false],
    ])('rejects %s', (email, expected) => {
        expect(isValidEmail(email)).toBe(expected);
    });
});

describe('getEmailError', () => {
    it('returns empty string for empty input', () => {
        expect(getEmailError('')).toBe('');
    });

    it('returns empty string for valid email', () => {
        expect(getEmailError('admin@hq.test')).toBe('');
    });

    it('returns error message for invalid email', () => {
        expect(getEmailError('notvalid')).toMatch(/invalid email/i);
    });
});
