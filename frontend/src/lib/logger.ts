/**
 * Comprehensive Logging System
 * Provides structured logging with multiple levels and transport options
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
    userId?: string;
    tenantId?: string;
    requestId?: string;
    sessionId?: string;
    [key: string]: unknown;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    duration?: number;
    [key: string]: unknown;
}

class Logger {
    private context: LogContext = {};
    private isDevelopment = import.meta.env.DEV;
    private minLevel: LogLevel = 'info';
    private levelOrder: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        fatal: 4,
    };

    setContext(context: Partial<LogContext>): void {
        this.context = { ...this.context, ...context };
    }

    clearContext(): void {
        this.context = {};
    }

    setMinLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelOrder[level] >= this.levelOrder[this.minLevel];
    }

    private formatEntry(entry: LogEntry): string {
        const { timestamp, level, message, context, error, duration, ...rest } = entry;
        const parts = [timestamp, `[${level.toUpperCase()}]`, message];

        if (context && Object.keys(context).length > 0) {
            parts.push(`ctx:${JSON.stringify(context)}`);
        }

        if (duration !== undefined) {
            parts.push(`${duration}ms`);
        }

        if (error) {
            parts.push(`\nError: ${error.name}: ${error.message}`);
            if (this.isDevelopment && error.stack) {
                parts.push(error.stack);
            }
        }

        if (Object.keys(rest).length > 0) {
            parts.push(`data:${JSON.stringify(rest)}`);
        }

        return parts.join(' ');
    }

    private sendToServer(entry: LogEntry): void {
        // In production, send logs to a server
        if (!this.isDevelopment) {
            // Avoid blocking the main thread
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/logs', JSON.stringify(entry));
            }
        }
    }

    private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: Object.keys(this.context).length > 0 ? this.context : undefined,
            ...data,
        };

        const formatted = this.formatEntry(entry);

        // Console output
        const consoleMethod = level === 'fatal' ? 'error' : (level as 'debug' | 'info' | 'warn' | 'error');
        console[consoleMethod](formatted);

        // Send to server
        this.sendToServer(entry);
    }

    debug(message: string, data?: Record<string, unknown>): void {
        this.log('debug', message, data);
    }

    info(message: string, data?: Record<string, unknown>): void {
        this.log('info', message, data);
    }

    warn(message: string, data?: Record<string, unknown>): void {
        this.log('warn', message, data);
    }

    error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
        const errorData: Record<string, unknown> = { ...data };

        if (error instanceof Error) {
            errorData.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        } else if (error) {
            errorData.error = { name: 'Unknown', message: String(error) };
        }

        this.log('error', message, errorData);
    }

    fatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
        const errorData: Record<string, unknown> = { ...data };

        if (error instanceof Error) {
            errorData.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        } else if (error) {
            errorData.error = { name: 'Unknown', message: String(error) };
        }

        this.log('fatal', message, errorData);
    }

    time(label: string): () => void {
        const start = performance.now();
        return () => {
            const duration = Math.round(performance.now() - start);
            this.info(`${label} completed`, { duration });
        };
    }

    group(label: string, callback: () => void): void {
        console.group(label);
        callback();
        console.groupEnd();
    }
}

export const logger = new Logger();

// Export convenience methods
export const log = {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    fatal: logger.fatal.bind(logger),
    setContext: logger.setContext.bind(logger),
    clearContext: logger.clearContext.bind(logger),
    time: logger.time.bind(logger),
    group: logger.group.bind(logger),
};
