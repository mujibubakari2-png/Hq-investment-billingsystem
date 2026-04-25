module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'bash',
      args: 'scripts/droplet-start.sh',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Restart on crash, but not in a tight loop
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 3000
    },
    {
      name: 'landing-page',
      cwd: './landing-page',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    }
    // NOTE: frontend (billing) is served as a static build via nginx.
    // Run: pnpm --filter frontend build
    //      sudo cp -r frontend/dist/* /var/www/html/billing/
    // No PM2 process needed for the frontend.
  ]
};
