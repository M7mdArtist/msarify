module.exports = {
  apps: [
    {
      name: "msarify",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000
      }
    }
  ]
};
