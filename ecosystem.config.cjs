/**
 * PM2 config for Hostinger VPS (or any Linux server).
 * Usage: npm run build && pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'lead-management',
      script: 'server.js',
      cwd: `${__dirname}/backend`,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        SERVE_FRONTEND: '1',
      },
    },
  ],
};
