@echo off
chcp 65001 >nul
title LOCKET VIP SERVER
echo ============================================================
echo   👑 DANG MO SERVER LOCKET VIP (49+ FILTER AI)...
echo ============================================================
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
  taskkill /F /PID %%a >nul 2>&1
)
cd /d "%~dp0"
start http://localhost:3000
node server.js
pause