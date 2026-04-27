/**
 * Configuracao PM2 - Sistema de Monitoramento de Impressao HSE
 *
 * Uso (depois de `npm i -g pm2`):
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 status
 *   pm2 logs
 */
module.exports = {
  apps: [
    {
      name: 'hse-backend',
      cwd: './backend',
      script: 'src/index.js',
      // No Windows com nvm-windows, garantir o mesmo Node usado para compilar
      // o better-sqlite3 (NODE_MODULE_VERSION 115 = Node 20.x). Caso o servidor
      // de producao tenha Node 20 no PATH global, esta linha pode ser omitida.
      interpreter: process.env.PM2_NODE_INTERPRETER || undefined,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '15s',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        TZ: 'America/Recife',
      },
      time: true,
      merge_logs: true,
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
    },
    {
      name: 'hse-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '15s',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'America/Recife',
      },
      time: true,
      merge_logs: true,
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
    },
  ],
};
