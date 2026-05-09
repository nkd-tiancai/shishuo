@echo off
title 师说 - 初始化

echo.
echo ==========================================
echo         师说 - 一键初始化
echo ==========================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] 未检测到 Node.js，请先安装
    echo     打开 https://nodejs.org 下载 LTS 版本
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

echo.
echo [1/3] 正在安装依赖...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [X] 依赖安装失败
    pause
    exit /b 1
)
echo [OK] 依赖安装完成

echo.
echo [2/3] 配置环境变量...
if not exist ".env.local" (
    copy .env.example .env.local >nul
    echo [OK] 已从 .env.example 创建 .env.local
    echo.
    echo ==========================================
    echo   请现在用记事本打开 .env.local 文件
    echo   填入你的 CONTENT_ROOT 和 API Keys：
    echo.
    echo   CONTENT_ROOT=你的项目根目录
    echo   DEEPSEEK_API_KEY=sk-xxx
    echo   MINIMAX_API_KEY=xxx
    echo ==========================================
    echo.
    start notepad .env.local
) else (
    echo [OK] .env.local 已存在
)

echo.
echo [3/3] 初始化完成！

:: Create content directories if CONTENT_ROOT is set as default
if not exist "..\辅导\teacher" mkdir "..\辅导\teacher"
if not exist "..\辅导\teacher\课堂记录" mkdir "..\辅导\teacher\课堂记录"
if not exist "..\辅导\teacher\quiz" mkdir "..\辅导\teacher\quiz"
if not exist "..\辅导\markdown" mkdir "..\辅导\markdown"
if not exist "data" mkdir "data"

echo.
echo ==========================================
echo       初始化完成，开始使用吧！
echo ==========================================
echo.
echo 现在双击"启动.bat"即可启动学习空间
echo.
pause
