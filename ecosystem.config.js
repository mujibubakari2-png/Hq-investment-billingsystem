module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'pnpm',
      args: 'start',
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
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'frontend',
      cwd: './frontend',
      script: 'pnpm',
      args: 'run preview --host 0.0.0.0 --port 5173',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
