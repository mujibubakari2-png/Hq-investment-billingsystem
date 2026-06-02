/**
 * PM2 Ecosystem Configuration
 * HQ Investment Billing System — Production
 *
 * Commands:
 *   pm2 start ecosystem.config.js          → start all apps
 *   pm2 reload ecosystem.config.js         → zero-downtime reload (cluster mode)
 *   pm2 restart ecosystem.config.js        → hard restart all apps
 *   pm2 reload ecosystem.config.js --only backend --update-env
 */

module.exports = {
  apps: [
    // ─── Backend API (Node.js / Express) ─────────────────────────────────────
    {
      name: 'backend',
      cwd: '/var/www/Hq-investment-billingsystem/backend',
      script: 'node',
      args: ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'],
      instances: 1,                        // single instance for single-core server
      exec_mode: 'fork',                   // fork mode: simple, stable, no port conflicts
      max_memory_restart: '512M',          // auto-restart if memory exceeds 512 MB
      exp_backoff_restart_delay: 100,      // delay grows exponentially on crash loops
      max_restarts: 10,                    // give up after 10 consecutive crashes
      min_uptime: '10s',                   // must stay alive 10s to count as "stable"
      watch: false,                        // never watch files in production
      error_file: '/var/www/Hq-investment-billingsystem/logs/backend-error.log',
      out_file:   '/var/www/Hq-investment-billingsystem/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },

    // ─── Landing Page (Next.js / static server) ───────────────────────────────
    // If landing-page is pure static HTML served by Nginx, remove this block
    // and point Nginx root to /var/www/Hq-investment-billingsystem/landing-page/public
    {
      name: 'landing-page',
      cwd: '/var/www/Hq-investment-billingsystem/landing-page',
      script: 'node',
      args: ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'],
      instances: 1,                        // single instance is fine for landing page
      exec_mode: 'fork',
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      error_file: '/var/www/Hq-investment-billingsystem/logs/landing-error.log',
      out_file:   '/var/www/Hq-investment-billingsystem/logs/landing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }

    // NOTE: The frontend (Vite SPA) is served directly by Nginx from
    // /var/www/Hq-investment-billingsystem/frontend/dist/
    // No PM2 process is needed — only rebuild and Nginx picks it up.
  ],

  // ─── PM2 Deploy (optional — for pm2 deploy workflow) ─────────────────────
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['YOUR_VPS_IP'],
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_ORG/Hq-investment-billingsystem.git',
      path: '/var/www/Hq-investment-billingsystem',
      'pre-deploy-local': '',
      'post-deploy':
        'pnpm install --frozen-lockfile && ' +
        'pnpm run build --filter=backend && ' +
        'pnpm run build --filter=frontend && ' +
        'pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
