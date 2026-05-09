@echo off
title 师说 - 学习空间

cd /d "%~dp0"

echo.
echo ==========================================
echo         师说 - 启动学习空间
echo ==========================================
echo.
echo 正在启动服务... (首次启动约 10 秒)
echo 启动后打开浏览器访问 http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务
echo ==========================================
echo.

call npm run dev

pause
