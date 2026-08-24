@echo off
setlocal
set "BAYOU_NODE=node.exe"
where node >nul 2>nul
if not errorlevel 1 goto run
set "BAYOU_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%BAYOU_NODE%" goto run
echo Bayou Brawlers needs Node.js 18 or newer.
echo Install Node.js, then run this file again.
pause
exit /b 1

:run
start "Bayou Brawlers Server" /min "%BAYOU_NODE%" "%~dp0scripts\serve.mjs" 4173
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
endlocal
