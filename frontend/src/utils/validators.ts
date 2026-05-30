// ── Shared validation utilities ───────────────────────────────────────────────
// Used across modals and forms for consistent client-side validation.

/**
 * Validates a Tanzanian phone number.
 * Accepts formats: 255XXXXXXXXX, 0XXXXXXXXX (with optional spaces).
 */
export function isValidPhone(phone: string): boolean {
    return /^(255|0)[0-9]{9}$/.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Returns a user-friendly error message for invalid phone numbers,
 * or an empty string if the phone is valid (or empty).
 */
export function getPhoneError(phone: string): string {
    if (!phone || !phone.trim()) return '';
    return isValidPhone(phone)
        ? ''
        : 'Invalid phone number (e.g. 255712345678)';
}

/**
 * Validates an email address.
 */
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Returns a user-friendly error message for invalid emails,
 * or an empty string if the email is valid (or empty).
 */
export function getEmailError(email: string): string {
    if (!email || !email.trim()) return '';
    return isValidEmail(email)
        ? ''
        : 'Invalid email address';
}
