@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org/ and run dev.bat again.
  pause
  exit /b 1
)
if not exist app.js (
  echo Missing app.js. Please extract the entire ZIP.
  pause
  exit /b 1
)
if not exist index.html (
  echo Missing index.html. Please extract the entire ZIP.
  pause
  exit /b 1
)
node dev-server.cjs
if errorlevel 1 pause
