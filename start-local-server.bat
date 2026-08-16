@echo off
setlocal enableextensions
cd /d "%~dp0"

where wrangler >nul 2>nul
if errorlevel 1 (
  echo Wrangler CLI not found. Install it from https://developers.cloudflare.com/workers/wrangler/install/ and then rerun this script.
  exit /b 1
)

echo Starting Wrangler Pages dev server for local testing...
wrangler pages dev .
