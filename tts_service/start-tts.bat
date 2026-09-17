@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
echo === Kosar TTS Service (pocket-tts-farsi) ===
python tts_server.py --host 127.0.0.1 --port 8765
pause
