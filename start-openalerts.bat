@echo off
REM Double-click this file on the firehouse Windows 10 PC to start OpenAlerts.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install Node.js 22 LTS from https://nodejs.org/ then try again.
  pause
  exit /b 1
)

if not exist "dist\index.js" (
  echo Building OpenAlerts...
  call npm run build
  if errorlevel 1 (
    echo Build failed. See the messages above.
    pause
    exit /b 1
  )
)

echo Starting OpenAlerts on port 3000...
echo Open http://localhost:3000 on this PC, or http://THIS_PC_IP:3000 from the display Pis.
echo Close this window to stop the server.
echo.
node dist\index.js
echo.
echo Server stopped.
pause
