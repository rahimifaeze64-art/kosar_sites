#!/bin/bash

echo "========================================"
echo "🚀 راه‌اندازی پروژه کوثر"
echo "========================================"
echo ""

echo "[1/3] بررسی بک‌اند..."
cd backend
python manage.py migrate > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ خطا در migrate"
    exit 1
fi
echo "✅ دیتابیس آماده است"

echo ""
echo "[2/3] راه‌اندازی سرور بک‌اند..."
python manage.py runserver > /dev/null 2>&1 &
BACKEND_PID=$!
sleep 3
echo "✅ بک‌اند روی http://127.0.0.1:8000 اجرا شد (PID: $BACKEND_PID)"

cd ..
echo ""
echo "[3/3] راه‌اندازی سرور فرانت..."
python -m http.server 8080 > /dev/null 2>&1 &
FRONTEND_PID=$!
sleep 2
echo "✅ فرانت روی http://localhost:8080 اجرا شد (PID: $FRONTEND_PID)"

echo ""
echo "========================================"
echo "✅ پروژه آماده است!"
echo "========================================"
echo ""
echo "📱 صفحه تست: http://localhost:8080/test-connection.html"
echo "🏠 صفحه اصلی: http://localhost:8080/index.html"
echo "🔧 Admin Panel: http://127.0.0.1:8000/admin/"
echo ""
echo "اطلاعات ورود:"
echo "  مدیر: manager / 123456"
echo "  کارمند: zahra / 123456"
echo "  عامل: masoumi / 123456"
echo "  دانشجو: qasim / 123456"
echo ""
echo "برای توقف سرورها:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""

# باز کردن مرورگر
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:8080/test-connection.html
elif command -v open > /dev/null; then
    open http://localhost:8080/test-connection.html
fi

# نگه داشتن اسکریپت
echo "Press Ctrl+C to stop servers..."
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
