@echo off
setlocal
title Build PromptForge.exe
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NONODE

echo.
echo   Building single-file exe ...
echo.
node build\build-exe.mjs
echo.
echo   Output: release\PromptForge.exe
echo.
pause
exit /b 0

:NONODE
echo.
echo   [ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org/
echo.
pause
exit /b 1
