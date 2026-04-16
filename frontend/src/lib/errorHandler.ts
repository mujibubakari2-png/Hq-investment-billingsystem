/**
 * Comprehensive Error Handling Utilities
 * Provides typed error handling, logging, and user-friendly error messages
 */

export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly details?: Record<string, unknown>;

    constructor(
        code: string,
        message: string,
        statusCode: number = 500,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, string[]>) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super('AUTH_ERROR', message, 401);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
        super('AUTH_FORBIDDEN', message, 403);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super('NOT_FOUND', `${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super('CONFLICT', message, 409);
        this.name = 'ConflictError';
    }
}

export class RateLimitError extends AppError {
    constructor(retryAfter?: number) {
        super('RATE_LIMIT', 'Too many requests. Please try again later.', 429, { retryAfter });
        this.name = 'RateLimitError';
    }
}

export interface ErrorResponse {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
    timestamp: string;
}

export function toErrorResponse(error: unknown): ErrorResponse {
    const now = new Date().toISOString();

    if (error instanceof AppError) {
        return {
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            details: error.details,
            timestamp: now,
        };
    }

    if (error instanceof Error) {
        return {
            code: 'INTERNAL_ERROR',
            message: error.message,
            statusCode: 500,
            timestamp: now,
        };
    }

    return {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        statusCode: 500,
        timestamp: now,
    };
}

export function getUserFriendlyMessage(error: unknown): string {
    if (error instanceof ValidationError) {
        return 'Please check your inputs and try again.';
    }
    if (error instanceof AuthenticationError) {
        return 'Please log in to continue.';
    }
    if (error instanceof AuthorizationError) {
        return 'You do not have permission to perform this action.';
    }
    if (error instanceof NotFoundError) {
        return 'The requested resource was not found.';
    }
    if (error instanceof ConflictError) {
        return error.message;
    }
    if (error instanceof RateLimitError) {
        return 'You are making requests too quickly. Please slow down.';
    }
    if (error instanceof AppError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
}

export async function handleAsyncError<T>(
    fn: () => Promise<T>,
    errorHandler?: (error: unknown) => void
): Promise<T | null> {
    try {
        return await fn();
    } catch (error) {
        errorHandler?.(error);
        return null;
    }
}
