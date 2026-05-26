/**
 * Structured Logger
 *
 * Replaces scattered console.log/warn/error calls with a consistent,
 * levelled, JSON-structured logger suitable for production log aggregation
 * (e.g. DigitalOcean Papertrail, Logtail, Datadog).
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.info('User logged in', { userId, tenantId });
 *   logger.error('Payment failed', { error: err.message, ref });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// In production log at info+; in development log everything
const MIN_LEVEL: LogLevel =
  process.env.LOG_LEVEL as LogLevel ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
  }
}

const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => write('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => write('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),

  /** Log an API request (call at the start of a route handler) */
  request: (method: string, path: string, meta?: Record<string, unknown>) =>
    write('info', `${method} ${path}`, { type: 'request', ...meta }),

  /** Log an API error with status code */
  apiError: (method: string, path: string, status: number, message: string) =>
    write(status >= 500 ? 'error' : 'warn', `${method} ${path} → ${status}`, {
      type: 'api_error',
      status,
      message,
    }),

  /** Log a payment event */
  payment: (event: string, meta?: Record<string, unknown>) =>
    write('info', `[PAYMENT] ${event}`, { type: 'payment', ...meta }),

  /** Log a MikroTik operation */
  mikrotik: (action: string, host: string, meta?: Record<string, unknown>) =>
    write('info', `[MIKROTIK] ${action} → ${host}`, { type: 'mikrotik', host, ...meta }),
};

export default logger;
