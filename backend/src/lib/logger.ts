/**
 * Structured Logger
 *
 * DO-002 FIX: Added BetterStack (Logtail) transport for production log aggregation.
 * When LOGTAIL_SOURCE_TOKEN is set, all log entries are streamed to BetterStack
 * in addition to stdout — providing searchable, persistent logs with alerting.
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.info('User logged in', { userId, tenantId });
 *   logger.error('Payment failed', { error: err.message, ref });
 *
 * Setup:
 *   1. Create a source in BetterStack → https://betterstack.com/logs
 *   2. Copy the Source Token → add to .env: LOGTAIL_SOURCE_TOKEN=<token>
 *   3. Deploy — logs will appear in BetterStack dashboard within seconds
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

// ── RELIABILITY FIX: capture the ORIGINAL console methods now ────────────────
// instrumentation.ts monkey-patches console.log/warn/error at process start so
// that any stray console.* calls elsewhere in the codebase get routed through
// this logger. If write() below called the *live* console.log/warn/error, it
// would end up calling the patched version, which calls back into
// logger.info/warn/error, which calls console.log again — infinite recursion
// and an immediate stack overflow crash the moment any log line is written.
// Capturing bound references here, at module-load time (which happens BEFORE
// instrumentation.ts performs its override), guarantees this module always
// writes to the real stdout/stderr, no matter what happens to the global
// console object afterwards.
const _stdout = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

// ── BetterStack Transport (Batched) ───────────────────────────────────────────
// M6 FIX: Replace per-log-line HTTP requests with a micro-batch transport.
// Previously: every single log line = 1 HTTP POST to Logtail.
// Problem: at moderate traffic, this creates hundreds of concurrent connections,
// wastes bandwidth, and drops logs on transient failures (no retry).
//
// Solution: buffer entries for up to FLUSH_INTERVAL_MS (2s) OR until
// BATCH_SIZE (50) entries accumulate, then send a single batch.
// One retry on HTTP failure before silently dropping.

const LOGTAIL_TOKEN = process.env.LOGTAIL_SOURCE_TOKEN;
const LOGTAIL_URL = 'https://in.logtail.com';
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 2000;

let _batch: LogEntry[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _flushing = false;

async function flushBatch(): Promise<void> {
  if (_batch.length === 0 || _flushing) return;
  _flushing = true;
  const toSend = _batch.splice(0, BATCH_SIZE);
  try {
    const body = toSend.length === 1 ? JSON.stringify(toSend[0]) : JSON.stringify(toSend);
    const res = await fetch(LOGTAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOGTAIL_TOKEN}` },
      body,
    });
    if (!res.ok) {
      // One retry on server error
      await fetch(LOGTAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOGTAIL_TOKEN}` },
        body,
      }).catch(() => {});
    }
  } catch {
    // Silently drop — never block the application path for logging
  } finally {
    _flushing = false;
    // If more entries arrived while we were flushing, schedule another flush
    if (_batch.length > 0) scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (_flushTimer) return; // already scheduled
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushBatch().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

function sendToLogtail(entry: LogEntry): void {
  if (!LOGTAIL_TOKEN || process.env.NODE_ENV !== 'production' || process.env.JEST_WORKER_ID) return;
  _batch.push(entry);
  if (_batch.length >= BATCH_SIZE) {
    // Batch full — flush immediately
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    flushBatch().catch(() => {});
  } else {
    scheduleFlush();
  }
}

// Flush remaining entries when the process exits gracefully
if (process.env.NODE_ENV === 'production') {
  const flushOnExit = () => { if (_batch.length > 0) flushBatch().catch(() => {}); };
  process.once('SIGTERM', flushOnExit);
  process.once('SIGINT',  flushOnExit);
  process.once('beforeExit', flushOnExit);
}


// ── Core write function ───────────────────────────────────────────────────────

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'hq-investment-isp',
    env: process.env.NODE_ENV ?? 'development',
    ...meta,
  };

  // 1. Always write to stdout (PM2 captures this).
  // IMPORTANT: use the captured _stdout references, NOT the live global
  // console object — see the _stdout comment above for why.
  const line = JSON.stringify(entry);
  switch (level) {
    case 'debug':
    case 'info':
      _stdout.log(line);
      break;
    case 'warn':
      _stdout.warn(line);
      break;
    case 'error':
      _stdout.error(line);
      break;
  }

  // 2. DO-002: Forward to BetterStack in production
  sendToLogtail(entry);
}

// ── Logger API ────────────────────────────────────────────────────────────────

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

  /** Log a security event (auth failures, RBAC violations, SSRF blocks) */
  security: (event: string, meta?: Record<string, unknown>) =>
    write('warn', `[SECURITY] ${event}`, { type: 'security', ...meta }),

  /** Log a RADIUS sync event */
  radius: (event: string, meta?: Record<string, unknown>) =>
    write('info', `[RADIUS] ${event}`, { type: 'radius', ...meta }),
};

export default logger;
