#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Deployment Process..."

# 1. Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Build frontend
echo "🏗️ Building frontend..."
npm run build

# 4. Restart PM2 process
echo "🔄 Restarting PM2 process..."
# تأكد من أن الاسم يطابق الاسم الذي استخدمته عند تشغيل pm2 أول مرة
pm2 restart msarify --update-env

echo "✅ Deployment Successful!"
