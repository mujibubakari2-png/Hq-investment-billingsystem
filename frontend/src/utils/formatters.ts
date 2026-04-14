/**
 * Centralized date/currency/utility formatters for the frontend.
 * 
 * RULE: The backend always sends dates as ISO 8601 strings (or null).
 * These formatters handle parsing and display formatting with timezone support.
 */

/**
 * Safely parse any date-like input into a valid Date object.
 * Returns null if the input is not a valid date.
 */
function safeParse(date: any): Date | null {
    if (!date) return null;
    if (typeof date === 'string') {
        const trimmed = date.trim();
        if (['undefined', 'null', 'N/A', 'Invalid Date', ''].includes(trimmed)) return null;
    }
    if (date instanceof Date) {
        return isNaN(date.getTime()) ? null : date;
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date value for display (date only, no time).
 * Input: ISO string, Date object, timestamp, or null/undefined.
 * Output: Formatted string like "Apr 6, 2026" or "N/A".
 */
export const formatDate = (date: any): string => {
    const parsed = safeParse(date);
    if (!parsed) return 'N/A';
    
    try {
        return parsed.toLocaleDateString('en-US', {
            timeZone: 'Africa/Dar_es_Salaam',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return parsed.toDateString();
    }
};

/**
 * Format a date value for display (with time).
 * Input: ISO string, Date object, timestamp, or null/undefined.
 * Output: Formatted string like "Apr 6, 2026, 02:25 PM" or "N/A".
 */
export const formatDateTime = (date: any): string => {
    const parsed = safeParse(date);
    if (!parsed) return 'N/A';
    
    try {
        return parsed.toLocaleString('en-US', {
            timeZone: 'Africa/Dar_es_Salaam',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return parsed.toISOString();
    }
};

/**
 * Format a date value for use in HTML date inputs (YYYY-MM-DD).
 * Returns empty string if invalid.
 */
export const formatDateForInput = (date: any): string => {
    const parsed = safeParse(date);
    if (!parsed) return '';
    return parsed.toISOString().split('T')[0];
};

/**
 * Format a date in DD/MM/YYYY HH:mm format (exact/local display).
 * Used for admin tables that need precise timestamps.
 */
export const formatExactDate = (date: any): string => {
    const parsed = safeParse(date);
    if (!parsed) return 'N/A';
    
    try {
        // Use Africa/Dar_es_Salaam timezone for consistent display
        const opts: Intl.DateTimeFormatOptions = {
            timeZone: 'Africa/Dar_es_Salaam',
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        };
        const parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(parsed);
        const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
        return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
    } catch {
        return `${parsed.getDate().toString().padStart(2, '0')}/${(parsed.getMonth() + 1).toString().padStart(2, '0')}/${parsed.getFullYear()} ${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`;
    }
};

/**
 * Get a safe numeric timestamp for sorting.
 * Returns 0 if the date is invalid.
 */
export const toTimestamp = (date: any): number => {
    const parsed = safeParse(date);
    return parsed ? parsed.getTime() : 0;
};

export const formatCurrency = (amount: number): string => {
    return 'TZS ' + new Intl.NumberFormat('en-TZ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatPhone = (phone: string): string => {
    if (phone.startsWith('255')) {
        return `+${phone}`;
    }
    return phone;
};

/**
 * Generate a random password using the Web Crypto API (cryptographically secure).
 * Math.random() should never be used for security-sensitive values.
 */
export const generatePassword = (length: number = 8): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map((byte) => chars[byte % chars.length])
        .join('');
};

export const generateUsername = (): string => {
    return Math.floor(10000 + Math.random() * 90000).toString();
};
