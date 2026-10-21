#!/bin/bash

# ==============================================================================
# 🚀 Masarify Deployment & Auto-Start Script
# ==============================================================================

set -e

APP_NAME="msarify"
PORT="${PORT:-3000}"

echo "======================================================"
echo "🚀 بدء عملية النشر والتحديث (Deployment Script)"
echo "======================================================"

# 1. Pull latest changes if inside a Git repository
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "📥 جلب آخر التحديثات من GitHub (git pull)..."
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  git pull origin "$CURRENT_BRANCH" || git pull || echo "⚠️ تحذير: تعذر سحب التحديثات تلقائياً، سيتم المتابعة بالملفات الحالية."
else
  echo "ℹ️ مجلد المشروع ليس مستودع Git، تخطي git pull."
fi

# 2. Check and prepare database directory
if [ -n "$DB_PATH" ]; then
  DB_DIR=$(dirname "$DB_PATH")
  if [ ! -d "$DB_DIR" ]; then
    echo "📁 إنشاء مجلد قاعدة البيانات: $DB_DIR"
    mkdir -p "$DB_DIR" 2>/dev/null || true
  fi
fi

# 3. Install dependencies
echo "📦 تثبيت الحزم والاعتماديات (npm install)..."
npm install --prefer-offline --no-audit || npm install

# 4. Build frontend
echo "🏗️ بناء الواجهة الأمامية (npm run build)..."
npm run build

# 5. Start or Restart process
echo "🔄 التحقق من تشغيل الموقع عبر PM2..."

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    echo "🔄 العملية '$APP_NAME' تعمل حالياً، جاري إعادة تشغيلها وتحديث المتغيرات..."
    pm2 reload "$APP_NAME" --update-env 2>/dev/null || pm2 restart "$APP_NAME" --update-env
  else
    echo "⚡ العملية '$APP_NAME' ليست قيد التشغيل. جاري تشغيلها الآن..."
    if [ -f "ecosystem.config.cjs" ]; then
      pm2 start ecosystem.config.cjs --update-env
    else
      pm2 start npm --name "$APP_NAME" -- start --update-env
    fi
    pm2 save
    echo "✅ تم تشغيل العملية بنجاح وحفظها في PM2."
  fi
else
  echo "⚠️ تنبيه: PM2 غير مثبت في النظام."
  # Check if site is already running on port
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
    echo "ℹ️ الموقع يستجيب ويعمل حالياً على المنفذ $PORT."
  else
    echo "⚡ جاري تشغيل الموقع في الخلفية عبر nohup..."
    nohup npm start > app.log 2>&1 &
    sleep 2
    echo "💡 يُنصح بتثبيت PM2 لإدارة الموقع تلقائياً: npm install -g pm2"
  fi
fi

# 6. Health check
echo "🩺 التحقق من استجابة الموقع (Health Check)..."
sleep 3

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT" || echo "000")

if [ "$HEALTH_STATUS" = "200" ] || [ "$HEALTH_STATUS" = "302" ] || [ "$HEALTH_STATUS" = "304" ]; then
  echo "======================================================"
  echo "✅ تم النشر وتشغيل الموقع بنجاح تام! 🎉"
  echo "🌐 الموقع متاح ويعمل الآن على: http://localhost:$PORT"
  echo "======================================================"
else
  echo "======================================================"
  echo "⚠️ تنبيه: رمز الاستجابة هو ($HEALTH_STATUS)."
  echo "يرجى التحقق من السجلات عبر الأمر: pm2 logs $APP_NAME"
  echo "======================================================"
fi
