#!/bin/bash

# ==============================================================================
# 🩺 Masarify Server & Nginx Diagnostic Script
# ==============================================================================

echo "======================================================"
echo "🔍 فحص حالة السيرفر و Nginx (Server & Nginx Diagnostics)"
echo "======================================================"

# 1. Check .env PORT
APP_PORT="3000"
if [ -f .env ]; then
  ENV_PORT=$(grep -E '^\s*PORT=' .env | cut -d '=' -f2 | tr -d ' "\r\n' || true)
  if [ -n "$ENV_PORT" ]; then
    APP_PORT="$ENV_PORT"
  fi
  echo "📄 المنفذ المكتوب في .env: $APP_PORT"
else
  echo "ℹ️ ملف .env غير موجود، المنفذ الافتراضي: 3000"
fi

# 2. Check PM2 status
echo "------------------------------------------------------"
echo "🤖 حالة العملية في PM2:"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list
else
  echo "⚠️ PM2 غير مثبت في النظام."
fi

# 3. Check if app is listening on APP_PORT
echo "------------------------------------------------------"
echo "📡 فحص استجابة التطبيق محلياً على المنفذ ($APP_PORT):"
LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$APP_PORT" || echo "000")
if [ "$LOCAL_CODE" = "200" ] || [ "$LOCAL_CODE" = "302" ] || [ "$LOCAL_CODE" = "304" ]; then
  echo "✅ التطبيق يعمل بنجاح ويستجيب محلياً برمز (HTTP $LOCAL_CODE) على http://127.0.0.1:$APP_PORT"
else
  echo "❌ التطبيق لا يستجيب محلياً! رمز الاستجابة: ($LOCAL_CODE)"
  echo "💡 تحقق من سجلات التطبيق عبر الأمر: pm2 logs msarify --lines 20"
fi

# 4. Check Nginx Service Status
echo "------------------------------------------------------"
echo "🌐 فحص حالة خدمة Nginx:"
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet nginx; then
    echo "✅ خدمة Nginx تعمل بنشاط (Active & Running)."
  else
    echo "❌ خدمة Nginx متوقفة! يمكنك تشغيلها بالأمر: sudo systemctl start nginx"
  fi
fi

# 5. Check Nginx Configuration Syntax
echo "------------------------------------------------------"
echo "🧪 فحص صحة ملفات تكوين Nginx (nginx -t):"
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t 2>&1 || nginx -t 2>&1 || true
else
  echo "⚠️ أمر nginx غير متاح للمستخدم الحالي دون صلاحيات sudo."
fi

# 6. Check proxy_pass in Nginx
echo "------------------------------------------------------"
echo "🎯 المنافذ الموجهة في Nginx (proxy_pass):"
if [ -d "/etc/nginx/sites-enabled" ]; then
  grep -rn "proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null || echo "لم يتم العثور على توجيهات أو يتطلب sudo"
fi

echo "======================================================"
echo "💡 نصيحة لحل خطأ 502 Bad Gateway:"
echo "تأكد من أن المنفذ في proxy_pass يطابق المنفذ ($APP_PORT) الذي يعمل عليه التطبيق."
echo "======================================================"
