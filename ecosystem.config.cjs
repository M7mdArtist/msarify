module.exports = {
  apps: [
    {
      name: "msarify",
      script: "./node_modules/.bin/tsx",
      args: "server.ts",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
