@echo off
title Thread Track System Launcher
echo ==================================================
echo THREAD TRACK SYSTEM ONE-CLICK LAUNCHER
echo ==================================================
echo.
echo Starting Backend Express API Server (Port 5000)...
start "Thread Track Backend (5000)" cmd /k "cd backend && npm run dev"

echo.
echo Starting User Frontend Web App (Port 5173)...
start "Thread Track User Frontend (5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Starting Admin Control Panel Web App (Port 5174)...
start "Thread Track Admin Panel (5174)" cmd /k "cd admin && npm run dev"

echo.
echo ==================================================
echo ALL SYSTEM MODULES STARTED IN PARALLEL!
echo --------------------------------------------------
echo - Backend Port: 5000 (Health check: http://localhost:5000/health)
echo - User Site Port: 5173 (http://localhost:5173)
echo - Admin Site Port: 5174 (http://localhost:5174)
echo.
echo Keep the spawned command windows running.
echo ==================================================
pause
