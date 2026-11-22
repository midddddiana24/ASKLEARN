@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run the Windows setup steps in README.md first.
  pause
  exit /b 1
)
if not exist "frontend\dist\index.html" (
  echo Build the frontend first: cd frontend ^&^& npm.cmd ci ^&^& npm.cmd run build
  pause
  exit /b 1
)
echo ASKLearn: open http://127.0.0.1:8000 in your browser.
echo Press Ctrl+C to stop the server.
".venv\Scripts\python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
pause
