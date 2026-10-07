@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   ربات تلگرام تعدیلات - سیستم مدیریت تحصیلی
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [خطا] python روی این سیستم پیدا نشد.
    echo        پایتون 3.8 یا بالاتر نصب کنید.
    pause
    exit /b 1
)

if not exist "config.json" (
    echo [راه اندازی اولیه] ساخت فایل config.json ...
    python bot.py --init-config
    echo.
    echo فایل config.json ساخته شد.
    echo آن را با Notepad باز کنید و این دو مقدار را پر کنید:
    echo   1^) telegram_bot_token  ^(از @BotFather^)
    echo   2^) supabase_anon_key   ^(از js/supabase-config.js^)
    echo.
    notepad config.json
    pause
    exit /b 0
)

echo بررسی سلامت تنظیمات...
python bot.py --check
if errorlevel 1 (
    echo.
    echo [توجه] بررسی سلامت ایراد داشت. برای ادامه Enter بزنید یا پنجره را ببندید.
    pause
)

echo.
echo شروع ربات...  ^(برای توقف Ctrl+C^)
echo.
python bot.py
pause
