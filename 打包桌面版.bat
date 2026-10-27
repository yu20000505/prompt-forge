@echo off
setlocal
title Build PromptForge Desktop
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NONODE

echo.
echo   Building desktop app (Electron) ...
echo   First run downloads Electron, may take a few minutes.
echo.
node build\build-desktop.mjs
echo.
echo   Output: release-desktop\PromptForge-Desktop.exe
echo.
pause
exit /b 0

:NONODE
echo.
echo   [ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org/
echo.
pause
exit /b 1
