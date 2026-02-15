module.exports = {
  apps: [
    {
      name: 'server',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      listen_timeout: 10000,
      kill_timeout: 20000,
      env: {
        NODE_ENV: 'production',
        READINESS_TIMEOUT_MS: '2000',
        SHUTDOWN_TIMEOUT_MS: '15000'
      }
    }
  ]
};
