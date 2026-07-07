@echo off
echo ========================================
echo دانلود وابستگی‌های آفلاین
echo ========================================
echo.

REM ایجاد پوشه‌ها
echo [1/5] ایجاد پوشه‌ها...
if not exist "assets\libs" mkdir "assets\libs"
if not exist "assets\libs\fontawesome" mkdir "assets\libs\fontawesome"
if not exist "assets\libs\fontawesome\css" mkdir "assets\libs\fontawesome\css"
if not exist "assets\libs\fontawesome\webfonts" mkdir "assets\libs\fontawesome\webfonts"
if not exist "assets\fonts" mkdir "assets\fonts"
if not exist "assets\fonts\vazirmatn" mkdir "assets\fonts\vazirmatn"
echo    ✓ پوشه‌ها ایجاد شدند
echo.

REM دانلود Alpine.js
echo [2/5] دانلود Alpine.js...
powershell -Command "Invoke-WebRequest -Uri 'https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js' -OutFile 'assets/libs/alpine.min.js'"
if exist "assets\libs\alpine.min.js" (
    echo    ✓ Alpine.js دانلود شد
) else (
    echo    ✗ خطا در دانلود Alpine.js
)
echo.

REM دانلود Font Awesome CSS
echo [3/5] دانلود Font Awesome CSS...
powershell -Command "Invoke-WebRequest -Uri 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css' -OutFile 'assets/libs/fontawesome/css/all.min.css'"
if exist "assets\libs\fontawesome\css\all.min.css" (
    echo    ✓ Font Awesome CSS دانلود شد
) else (
    echo    ✗ خطا در دانلود Font Awesome CSS
)
echo.

REM دانلود Font Awesome Webfonts
echo [4/5] دانلود Font Awesome Webfonts...
powershell -Command "Invoke-WebRequest -Uri 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2' -OutFile 'assets/libs/fontawesome/webfonts/fa-solid-900.woff2'"
powershell -Command "Invoke-WebRequest -Uri 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-regular-400.woff2' -OutFile 'assets/libs/fontawesome/webfonts/fa-regular-400.woff2'"
powershell -Command "Invoke-WebRequest -Uri 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2' -OutFile 'assets/libs/fontawesome/webfonts/fa-brands-400.woff2'"
if exist "assets\libs\fontawesome\webfonts\fa-solid-900.woff2" (
    echo    ✓ Font Awesome Webfonts دانلود شدند
) else (
    echo    ✗ خطا در دانلود Font Awesome Webfonts
)
echo.

REM دانلود فونت وزیرمتن
echo [5/5] دانلود فونت وزیرمتن...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/Vazirmatn-font-v33.003.zip' -OutFile 'vazirmatn-temp.zip'"
if exist "vazirmatn-temp.zip" (
    echo    ✓ فونت وزیرمتن دانلود شد
    echo    ! لطفا فایل vazirmatn-temp.zip را استخراج کنید
    echo    ! فایل‌های woff2 را در assets/fonts/vazirmatn قرار دهید
) else (
    echo    ✗ خطا در دانلود فونت وزیرمتن
)
echo.

echo ========================================
echo دانلود تکمیل شد!
echo ========================================
echo.
echo مراحل بعدی:
echo 1. فایل vazirmatn-temp.zip را استخراج کنید
echo 2. فایل‌های .woff2 را در assets/fonts/vazirmatn کپی کنید
echo 3. فایل vazirmatn.css را ایجاد کنید (راهنما در OFFLINE_SETUP.md)
echo 4. index.html را بروزرسانی کنید
echo.
pause
