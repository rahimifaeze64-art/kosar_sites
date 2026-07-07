@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 راه‌اندازی پروژه کوثر
echo ========================================
echo.

echo [1/3] بررسی بک‌اند...
cd backend
python manage.py migrate >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ خطا در migrate
    pause
    exit /b 1
)
echo ✅ دیتابیس آماده است

echo.
echo [2/3] راه‌اندازی سرور بک‌اند...
start "Django Backend" cmd /k "python manage.py runserver"
timeout /t 3 >nul
echo ✅ بک‌اند روی http://127.0.0.1:8000 اجرا شد

cd ..
echo.
echo [3/3] راه‌اندازی سرور فرانت...
start "Frontend Server" cmd /k "python -m http.server 8080"
timeout /t 2 >nul
echo ✅ فرانت روی http://localhost:8080 اجرا شد

echo.
echo ========================================
echo ✅ پروژه آماده است!
echo ========================================
echo.
echo 📱 صفحه تست: http://localhost:8080/test-connection.html
echo 🏠 صفحه اصلی: http://localhost:8080/index.html
echo 🔧 Admin Panel: http://127.0.0.1:8000/admin/
echo.
echo اطلاعات ورود:
echo   مدیر: manager / 123456
echo   کارمند: zahra / 123456
echo   عامل: masoumi / 123456
echo   دانشجو: qasim / 123456
echo.
echo برای بستن سرورها، پنجره‌های CMD را ببندید
echo.
pause

start http://localhost:8080/test-connection.html
