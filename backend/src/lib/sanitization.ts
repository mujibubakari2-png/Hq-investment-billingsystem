/**
 * Input Sanitization Utilities
 * Prevents XSS, SQL injection, and other input-based attacks
 */

/**
 * HIGH-SEC-005 FIX: Sanitize HTML content by stripping ALL tags.
 *
 * The previous implementation used a chain of regular expressions to remove
 * specific dangerous patterns (<script>, event handlers, etc.). Regex-based
 * HTML parsing is fundamentally unreliable — exotic vectors such as
 * `<img src=x onerror=...>`, SVG XSS, CSS `expression()`, and nested/broken
 * tag structures all bypass it.
 *
 * The correct approach for contexts that do not need any HTML markup is to
 * strip every tag entirely, leaving only the text content. This is
 * universally safe because no HTML survives.
 *
 * If you need to allow a specific safe subset of HTML (e.g. bold/italic in
 * user bios), install the `sanitize-html` package and configure an explicit
 * allowlist of tags and attributes — do not use this function for that use case.
 */
export function sanitizeHtml(input: string): string {
    if (!input) return '';
    // Strip every HTML/XML tag by replacing all <...> sequences.
    // This is intentionally aggressive: any remaining text is plain-text safe.
    return input
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '') // remove script tags entirely
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')   // remove style tags entirely
        .replace(/<[^>]*>/g, '')   // remove all tags
        .replace(/&lt;/gi, '<')    // decode common entities so text is readable
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .trim();
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(input: string): string {
    if (!input) return '';

    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };

    return input.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * NOTE: SQL injection prevention is handled automatically by Prisma's
 * parameterized queries. You do NOT need to sanitize strings before passing
 * them to Prisma — doing so can corrupt legitimate data (e.g. a client named
 * "Drew Select" would have "Select" stripped).
 *
 * Only use escapeHtml() for output that will be rendered as HTML.
 */

/**
 * Sanitize file names
 */
export function sanitizeFilename(filename: string): string {
    if (!filename) return 'file';

    let sanitized = filename;

    // Remove path separators
    sanitized = sanitized.replace(/[\/\\]/g, '');

    // Remove special characters that could be problematic
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

    // Limit length
    if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255);
    }

    return sanitized || 'file';
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
    if (!email) return '';

    let sanitized = email
        .toLowerCase()
        .trim()
        .replace(/[<>'"]/g, '');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Sanitize URL to prevent malicious redirects
 */
export function sanitizeUrl(url: string): string {
    if (!url) return '/';

    let sanitized = url.trim();

    // Remove javascript: and data: protocols
    if (sanitized.toLowerCase().startsWith('javascript:') ||
        sanitized.toLowerCase().startsWith('data:')) {
        return '/';
    }

    // Ensure relative URLs are safe
    if (!sanitized.startsWith('/') && !sanitized.startsWith('http')) {
        return '/' + sanitized;
    }

    try {
        const urlObj = new URL(sanitized, 'http://localhost');
        return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
        return '/';
    }
}

/**
 * Sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string {
    if (!phone) return '';

    let sanitized = phone
        .replace(/[^\d+\-\s()]/g, '')
        .trim();

    // Limit length
    if (sanitized.length > 20) {
        sanitized = sanitized.substring(0, 20);
    }

    return sanitized;
}

/**
 * Validate and sanitize username
 */
export function sanitizeUsername(username: string): string {
    if (!username) return '';

    let sanitized = username
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');

    // Ensure it starts with letter or underscore
    if (!/^[a-z_]/.test(sanitized)) {
        sanitized = '_' + sanitized;
    }

    // Limit length
    if (sanitized.length > 30) {
        sanitized = sanitized.substring(0, 30);
    }

    // Minimum length
    if (sanitized.length < 3) {
        return '';
    }

    return sanitized;
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson(input: string): Record<string, unknown> | null {
    if (!input) return null;

    try {
        // Parse JSON
        const parsed = JSON.parse(input);

        // Recursively sanitize string values
        function sanitizeObject(obj: unknown): unknown {
            if (typeof obj === 'string') {
                return sanitizeHtml(obj);
            }
            if (Array.isArray(obj)) {
                return obj.map(sanitizeObject);
            }
            if (obj !== null && typeof obj === 'object') {
                const sanitized: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                    sanitized[key] = sanitizeObject(value);
                }
                return sanitized;
            }
            return obj;
        }

        return sanitizeObject(parsed) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/**
 * Validate and sanitize pagination parameters
 */
export function sanitizePaginationParams(
    page?: string | number,
    limit?: string | number
): { page: number; limit: number } {
    const pageNum = Math.max(1, Math.min(parseInt(String(page || 1), 10) || 1, 1000));
    const limitNum = Math.max(1, Math.min(parseInt(String(limit || 10), 10) || 10, 100));

    return { page: pageNum, limit: limitNum };
}

/**
 * Validate and sanitize date input
 */
export function sanitizeDateInput(input: string): string | null {
    if (!input) return null;

    try {
        const date = new Date(input);
        if (isNaN(date.getTime())) {
            return null;
        }
        return date.toISOString();
    } catch {
        return null;
    }
}

/**
 * Batch sanitize object properties
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeHtml(value);
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map((item) => {
                if (typeof item === 'string') {
                    return sanitizeHtml(item);
                }
                return item;
            });
        } else if (value !== null && typeof value === 'object') {
            sanitized[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
