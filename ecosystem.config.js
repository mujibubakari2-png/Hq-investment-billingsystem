/**
 * PM2 Ecosystem Configuration
 * HQ Investment Billing System - Production
 *
 * Important:
 * - Do not point PM2 at node_modules/.bin/next with interpreter: 'node'.
 *   On Linux that file can be a shell shim, and Node will parse it as
 *   JavaScript, causing: SyntaxError: missing ) after argument list.
 * - Use Next's real JavaScript CLI: node_modules/next/dist/bin/next.
 * - Keep production in fork mode unless you intentionally design a multi-port
 *   Nginx upstream or have tested cluster mode on your VPS.
 *
 * Commands:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production --update-env
 *   pm2 logs backend --lines 100
 */

const PROJECT_DIR = '/var/www/Hq-investment-billingsystem';

module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: `${PROJECT_DIR}/backend`,
      script: 'node_modules/next/dist/bin/next',
      interpreter: 'node',
      args: 'start --hostname 127.0.0.1 --port 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1024M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: `${PROJECT_DIR}/logs/backend-error.log`,
      out_file: `${PROJECT_DIR}/logs/backend-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '127.0.0.1',
        PORT: '3000'
      },
      env_production: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '127.0.0.1',
        PORT: '3000'
      }
    },
    {
      name: 'landing-page',
      cwd: `${PROJECT_DIR}/landing-page`,
      script: 'node_modules/next/dist/bin/next',
      interpreter: 'node',
      args: 'start --hostname 127.0.0.1 --port 3001',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: `${PROJECT_DIR}/logs/landing-error.log`,
      out_file: `${PROJECT_DIR}/logs/landing-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '127.0.0.1',
        PORT: '3001'
      },
      env_production: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '127.0.0.1',
        PORT: '3001'
      }
    },

    // The Vite frontend is served by Nginx from frontend/dist.
    // It does not need a PM2 process.

    // ─── Worker Processes ────────────────────────────────────────────────────────

    /**
     * RADIUS User Synchronization Worker
     * 
     * RAD-W-001 FIX: Processes RADIUS sync jobs asynchronously.
     * Prevents slow RADIUS servers from blocking API request threads.
     * Architecture: Event Queue → Radius Worker → RADIUS Server
     */
    {
      name: 'radius-worker',
      cwd: `${PROJECT_DIR}/backend`,
      script: 'npx',
      args: 'tsx src/workers/radius.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: `${PROJECT_DIR}/logs/radius-worker-error.log`,
      out_file: `${PROJECT_DIR}/logs/radius-worker-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      env_production: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      }
    },

    /**
     * MikroTik Router Operations Worker
     * 
     * MK-002: Processes MikroTik operations from the Redis queue asynchronously.
     * Prevents API timeouts from router connectivity issues.
     * Architecture: Event Queue → Router Worker → MikroTik API
     */
    {
      name: 'mikrotik-worker',
      cwd: `${PROJECT_DIR}/backend`,
      script: 'npx',
      args: 'tsx src/workers/mikrotik.worker.ts',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: `${PROJECT_DIR}/logs/mikrotik-worker-error.log`,
      out_file: `${PROJECT_DIR}/logs/mikrotik-worker-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      env_production: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      }
    },
  ]
};
