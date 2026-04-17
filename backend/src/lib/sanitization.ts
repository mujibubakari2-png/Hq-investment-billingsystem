/**
 * Input Sanitization Utilities
 * Prevents XSS, SQL injection, and other input-based attacks
 */

/**
 * Sanitize HTML content to remove script tags and dangerous attributes
 */
export function sanitizeHtml(input: string): string {
    if (!input) return '';

    let sanitized = input;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*['"][^'"]*['"]/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove iframe tags
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove base tag
    sanitized = sanitized.replace(/<base\b[^>]*>/gi, '');

    // Remove link tags with javascript:
    sanitized = sanitized.replace(/<link\b[^>]*href\s*=\s*['"]?javascript:[^'">\s]*['"]?[^>]*>/gi, '');

    // Remove forms
    sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    return sanitized.trim();
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
 * Sanitize user input to prevent SQL injection
 */
export function sanitizeSqlInput(input: string): string {
    if (!input) return '';

    let sanitized = input;

    // Remove SQL comments
    sanitized = sanitized.replace(/--.*$/gm, '');
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove common SQL injection patterns
    sanitized = sanitized.replace(/(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|DECLARE)\b)/gi, '');

    // Replace potentially dangerous characters outside of quotes
    sanitized = sanitized.replace(/[;'"]/g, '');

    return sanitized.trim();
}

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
