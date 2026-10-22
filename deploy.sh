#!/bin/bash

# ==============================================================================
# 🚀 Masarify Deployment & Auto-Start Script
# ==============================================================================

set -e

APP_NAME="msarify"

# Read PORT from .env if present, otherwise default to 3000
PORT="3000"
if [ -f .env ]; then
  ENV_PORT=$(grep -E '^\s*PORT=' .env | cut -d '=' -f2 | tr -d ' "\r\n' || true)
  if [ -n "$ENV_PORT" ]; then
    PORT="$ENV_PORT"
  fi
fi
if [ -n "$SERVER_PORT" ]; then
  PORT="$SERVER_PORT"
fi

echo "======================================================"
echo "🚀 بدء عملية النشر والتحديث (Deployment Script)"
echo "📡 المنفذ المحدد للتطبيق: $PORT"
echo "======================================================"

# 1. Pull latest changes if inside a Git repository
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "📥 جلب آخر التحديثات من GitHub (git pull)..."
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  git pull origin "$CURRENT_BRANCH" || git pull || echo "⚠️ تحذير: تعذر سحب التحديثات تلقائياً، سيتم المتابعة بالملفات الحالية."
else
  echo "ℹ️ مجلد المشروع ليس مستودع Git، تخطي git pull."
fi

# 2. Check and prepare database directory & file permissions
if [ -f .env ]; then
  ENV_DB_PATH=$(grep -E '^\s*DB_PATH=' .env | cut -d '=' -f2 | tr -d ' "\r\n' || true)
  if [ -n "$ENV_DB_PATH" ]; then
    DB_DIR=$(dirname "$ENV_DB_PATH")
    if [ ! -d "$DB_DIR" ]; then
      echo "📁 إنشاء مجلد قاعدة البيانات: $DB_DIR"
      mkdir -p "$DB_DIR" 2>/dev/null || true
    fi
    if [ -f "$ENV_DB_PATH" ]; then
      chmod 666 "$ENV_DB_PATH" 2>/dev/null || true
    fi
  fi
fi
chmod 666 data.db 2>/dev/null || true
if [ -f "/home/msarify/database.sqlite" ]; then
  chmod 666 "/home/msarify/database.sqlite" 2>/dev/null || true
fi

# 3. Install dependencies (including tsx for running server)
echo "📦 تثبيت الحزم والاعتماديات (npm install)..."
npm install --prefer-offline --no-audit || npm install

# 4. Build frontend
echo "🏗️ بناء الواجهة الأمامية (npm run build)..."
npm run build

# 5. Start or Restart process via PM2 (Fork Mode)
echo "🔄 التحقق من تشغيل الموقع عبر PM2..."

if command -v pm2 >/dev/null 2>&1; then
  echo "🧹 تنظيف العملية السابقة والتأكد من العمل بوضع fork المستقر..."
  pm2 delete "$APP_NAME" 2>/dev/null || true
  
  if [ -f "ecosystem.config.cjs" ]; then
    pm2 start ecosystem.config.cjs --update-env
  else
    pm2 start ./node_modules/.bin/tsx --name "$APP_NAME" -- server.ts
  fi
  pm2 save
  echo "✅ تم تشغيل وحفظ تكوين PM2 بنجاح."
else
  echo "⚠️ تنبيه: PM2 غير مثبت في النظام."
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
    echo "ℹ️ الموقع يستجيب ويعمل حالياً على المنفذ $PORT."
  else
    echo "⚡ جاري تشغيل الموقع في الخلفية عبر nohup..."
    nohup npm start > app.log 2>&1 &
    sleep 3
    echo "💡 يُنصح بتثبيت PM2 لإدارة الموقع تلقائياً: npm install -g pm2"
  fi
fi

# 6. Health check
echo "🩺 التحقق من استجابة الموقع (Health Check على المنفذ $PORT)..."
sleep 4

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT" || echo "000")

if [ "$HEALTH_STATUS" = "200" ] || [ "$HEALTH_STATUS" = "302" ] || [ "$HEALTH_STATUS" = "304" ]; then
  echo "======================================================"
  echo "✅ تم النشر وتشغيل الموقع بنجاح تام! 🎉"
  echo "🌐 التطبيق متاح ويعمل محلياً على: http://localhost:$PORT"
  echo "======================================================"
else
  echo "======================================================"
  echo "⚠️ تنبيه: رمز الاستجابة هو ($HEALTH_STATUS) على المنفذ $PORT."
  echo "📋 آخر 20 سطر من سجلات PM2 لتشخيص السبب:"
  echo "------------------------------------------------------"
  pm2 logs "$APP_NAME" --lines 20 --nostream 2>/dev/null || true
  echo "------------------------------------------------------"
  echo "💡 إذا كان Nginx يعرض 502 Bad Gateway، يرجى التأكد من أن المنفذ في Nginx يطابق المنفذ ($PORT)."
  echo "======================================================"
fi
