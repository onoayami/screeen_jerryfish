@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0A3-Windows解凍確認.ps1"
set RESULT=%ERRORLEVEL%
echo.
pause
exit /b %RESULT%
