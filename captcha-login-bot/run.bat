@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules (
    echo [1/2] نصب وابستگی‌ها... اولین اجرا کمی طول می‌کشد
    call npm install
    if errorlevel 1 ( echo خطا در npm install & pause & exit /b 1 )
)

rem مرورگر: از Chrome/Edge نصب‌شده ویندوز استفاده می‌شود (بدون دانلود).
rem اگر Chromium اختصاصی خواستی، یک‌بار با فیلترشکن:
rem   set PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/
rem   npx playwright install chromium

node login-bot.js %*
