module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'pnpm',
      args: 'next:start',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'landing-page',
      cwd: './landing-page',
      script: 'pnpm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      error_file: './logs/landing-error.log',
      out_file: './logs/landing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
    // NOTE: 'frontend' is a static Vite build — it is served by nginx directly
    // from /var/www/html/billing. No PM2 process needed for it in production.
    // Only run the frontend PM2 process if you need `vite preview` (not recommended in prod).
  ]
};
