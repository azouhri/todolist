@echo off
REM Starts the Follow-up Manager on http://localhost:3000 in production mode.
REM Used by the scheduled task created by install-autostart.ps1, and fine to
REM double-click as well.

cd /d "%~dp0..\web" || exit /b 1

REM Build once if there is no production build yet.
if not exist ".next\BUILD_ID" (
  echo No production build found, building...
  call npm run build || exit /b 1
)

echo Starting on http://localhost:3000
call npm run start
