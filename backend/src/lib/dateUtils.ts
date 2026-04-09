/**
 * Centralized Date Utilities for the backend.
 *
 * RULE: API responses should always send dates as ISO 8601 strings.
 * Formatting for display is the frontend's responsibility.
 * These helpers are primarily for:
 *   1. Parsing/validating incoming dates from client requests (POST/PUT)
 *   2. Safely converting dates to ISO strings for JSON responses
 */

/**
 * Safely parse any date-like input into a valid Date, or return fallback.
 * Handles: Date objects, ISO strings, timestamps, invalid/garbage strings.
 */
export function parseSafeDate(dateVal: any, fallback: Date | null = null): Date | null {
    if (dateVal === null || dateVal === undefined) return fallback;
    if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();
        if (['undefined', 'null', 'N/A', 'Invalid Date', ''].includes(trimmed)) {
            return fallback;
        }
    }
    // If it's already a valid Date object
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? fallback : dateVal;
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? fallback : d;
}

/**
 * Safely parse any date-like input into an ISO string, or return fallback.
 * Use this when you need to store a validated date string (e.g., for Transaction.expiryDate which is String?).
 */
export function parseSafeDateString(dateVal: any, fallback: string | null = null): string | null {
    const d = parseSafeDate(dateVal);
    if (!d) return fallback;
    return d.toISOString();
}

/**
 * For Prisma update operations — returns undefined (skip update) if value is not a parseable date.
 */
export function parseOptionalDate(dateVal: any): Date | undefined {
    if (dateVal === undefined) return undefined;
    const p = parseSafeDate(dateVal);
    return p === null ? undefined : p;
}

/**
 * Safely convert a date-like value to an ISO 8601 string for API responses.
 * Returns null if the date is invalid/missing — let the frontend handle display of nulls.
 */
export function toISOSafe(dateVal: any): string | null {
    if (dateVal === null || dateVal === undefined) return null;
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? null : dateVal.toISOString();
    }
    if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();
        if (['undefined', 'null', 'N/A', 'Invalid Date', ''].includes(trimmed)) {
            return null;
        }
        // If it's already an ISO string, validate and return
        const d = new Date(trimmed);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof dateVal === 'number') {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
}

/**
 * Get a safe numeric timestamp from a date-like value.
 * Returns 0 if invalid — useful for sorting.
 */
export function toTimestampSafe(dateVal: any): number {
    if (dateVal === null || dateVal === undefined) return 0;
    if (dateVal instanceof Date) {
        const t = dateVal.getTime();
        return isNaN(t) ? 0 : t;
    }
    const d = new Date(dateVal);
    const t = d.getTime();
    return isNaN(t) ? 0 : t;
}

/**
 * Check if a date-like value is a valid, parseable date.
 */
export function isValidDate(d: any): boolean {
    if (d === null || d === undefined) return false;
    if (d instanceof Date) return !isNaN(d.getTime());
    const parsed = new Date(d);
    return !isNaN(parsed.getTime());
}

/**
 * TZ-aware period helpers. 
 * Default is Africa/Dar_es_Salaam (UTC+3) to match frontend formatting.
 */
const DEFAULT_TZ = 'Africa/Dar_es_Salaam';

export function getTZDateComponents(date: Date = new Date(), timeZone: string = DEFAULT_TZ) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    }).formatToParts(date);

    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

    return {
        year: getPart('year'),
        month: getPart('month') - 1, // 0-indexed
        day: getPart('day'),
        hour: getPart('hour'),
        minute: getPart('minute'),
        second: getPart('second')
    };
}

/**
 * Returns the numeric timestamp (ms) for the start of the day in the specified TZ.
 */
export function getStartOfTodayTZ(timeZone: string = DEFAULT_TZ): number {
    const comp = getTZDateComponents(new Date(), timeZone);
    // Create a string in a format that Date constructor reliably parses as local components
    // and then convert to UTC. But easier:
    // We want the UTC time that corresponds to 00:00:00 in the target TZ.
    
    // Construct ISO string for 00:00 in target TZ
    const iso = `${comp.year}-${String(comp.month + 1).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}T00:00:00`;
    
    // Now we need to know the offset. Since TZ is constant UTC+3 for Tanzania:
    if (timeZone === 'Africa/Dar_es_Salaam') {
        return new Date(`${iso}+03:00`).getTime();
    }
    
    // Generic fallback (might be slightly off if offset varies)
    return new Date(iso).getTime();
}

/**
 * Returns the numeric timestamp (ms) for the start of the month in the specified TZ.
 */
export function getStartOfMonthTZ(timeZone: string = DEFAULT_TZ): number {
    const comp = getTZDateComponents(new Date(), timeZone);
    const iso = `${comp.year}-${String(comp.month + 1).padStart(2, '0')}-01T00:00:00`;
    
    if (timeZone === 'Africa/Dar_es_Salaam') {
        return new Date(`${iso}+03:00`).getTime();
    }
    return new Date(iso).getTime();
}

/**
 * Returns the numeric timestamp (ms) for the end of the month in the specified TZ.
 */
export function getEndOfMonthTZ(timeZone: string = DEFAULT_TZ): number {
    const comp = getTZDateComponents(new Date(), timeZone);
    // Get last day of month
    const lastDay = new Date(comp.year, comp.month + 1, 0).getDate();
    const iso = `${comp.year}-${String(comp.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999`;
    
    if (timeZone === 'Africa/Dar_es_Salaam') {
        return new Date(`${iso}+03:00`).getTime();
    }
    return new Date(iso).getTime();
}
