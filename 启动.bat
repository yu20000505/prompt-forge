@echo off
setlocal
title Prompt Forge
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NONODE

"node" src\server.mjs
echo.
echo   Server stopped. Press any key to close this window.
pause >nul
exit /b 0

:NONODE
echo.
echo   [ERROR] Node.js not found.
echo   Install Node.js 20+ from https://nodejs.org/ then run this again.
echo.
pause
exit /b 1
