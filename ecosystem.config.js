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
      name: 'frontend',
      cwd: './frontend',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 5173
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
    }
  ]
};
