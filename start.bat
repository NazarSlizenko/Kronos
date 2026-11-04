@echo off
setlocal
cd /d "%~dp0"

start "Kronos Backend" cmd /k "cd /d D:\Kronos\webapp\backend && D:\Kronos\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"
start "Kronos Frontend" cmd /k "cd /d D:\Kronos\webapp\frontend && npm run dev -- --host 0.0.0.0 --port 5173"

echo Kronos backend and frontend have been started.
echo Backend: http://127.0.0.1:8001/docs
echo Frontend: http://localhost:5173
pause
