@echo off
title 师说 - 清理缓存

cd /d "%~dp0"

echo.
echo 正在清理编译缓存 .next ...
rmdir /s /q ".next" 2>nul && echo [OK] .next 已删除 || echo .next 不存在，跳过

echo.
echo 清理完成！下次启动会自动重建。
echo.
pause
