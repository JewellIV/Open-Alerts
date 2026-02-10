/**
 * PM2 ecosystem config for OpenAlerts backend.
 * Run from project root: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'mvfd-backend',
      script: 'npm',
      args: 'run start',
      cwd: __dirname,
      interpreter: 'none',
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
  ],
};
