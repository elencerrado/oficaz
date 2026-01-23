@echo off
setlocal enabledelayedexpansion

REM Load .env file variables (skip comments and empty lines)
for /f "usebackq tokens=1* delims==" %%a in (`type .env`) do (
  if not "%%a"=="" (
    REM Skip lines that start with #
    set "__first=%%a"
    if not "!__first:~0,1!"=="#" (
      set "%%a=%%b"
    )
  )
)
set "__first="

REM Set NODE_ENV for development
set NODE_ENV=development
set PORT=5000

REM Start the server with tsx
call npx tsx --watch server/index.ts

endlocal
