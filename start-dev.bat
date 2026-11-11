@echo off
rem Starts the demo on http://localhost:5180 and opens it in the browser.
rem If the packages are missing it installs them first, and if the demo is
rem already running it stops that one first, so this always starts it afresh.
rem Ctrl+C stops it. Answer N to the question that follows to keep the window
rem open, so any error can be read; Y closes it.
setlocal
cd /d "%~dp0"
set "PORT=5180"
set "URL=http://localhost:%PORT%"

rem Vite is only ever in node_modules, which npm ci fills from the lockfile.
if not exist "node_modules\.bin\vite.cmd" (
  echo The packages are missing, so installing them from the lockfile.
  call npm ci
  if errorlevel 1 (
    echo.
    echo Installing the packages failed: see the error above.
    pause
    exit /b 1
  )
)

rem The port is fixed (strictPort in vite.config.ts), so a second copy can only
rem fail. It looks for the demo's title, so anything else on the port is left
rem for Vite to report rather than stopped.
curl -s -m 1 "%URL%" | findstr /c:"systant-prism demo" >nul
if errorlevel 1 goto start

echo The demo is already running, so stopping it first.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr LISTENING') do (
  taskkill /f /t /pid %%p >nul 2>nul
)

rem Vite can't have the port until Windows has let go of it. ping is the wait,
rem as timeout refuses to run without a console to read from.
set "WAITED=0"
:waitForPort
netstat -ano | findstr /c:":%PORT% " | findstr LISTENING >nul
if errorlevel 1 goto start
set /a WAITED+=1
if %WAITED% geq 10 (
  echo.
  echo The demo that was running would not stop.
  pause
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto waitForPort

:start
call npm run dev -- --open
pause
