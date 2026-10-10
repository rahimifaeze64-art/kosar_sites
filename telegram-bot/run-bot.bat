@echo off
cd /d "%~dp0"
title Rabot Tadilat - Kosar
echo [%date% %time%] watchdog shoroo shod >> watchdog.log
:loop
echo [%date% %time%] rabot ejra mishavad... >> watchdog.log
"C:\Users\Bpservice.ir\AppData\Local\Programs\Python\Python314\python.exe" bot.py >> watchdog.log 2>&1
echo [%date% %time%] rabot baste shod - 15 sanie digar >> watchdog.log
timeout /t 15 /nobreak >nul
goto loop