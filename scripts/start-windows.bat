@echo off
setlocal

cd /d "%~dp0\.."

if not exist "node_modules\" (
  echo Missing node_modules. Run: pnpm install ^(recommended^) or npm install
  pause
  exit /b 1
)

if not exist "config\config.json" (
  echo Missing config\config.json. Run:
  echo   pnpm set-password
  echo   ^(or: npm run set-password^)
  pause
  exit /b 1
)

if not exist "web\dist\index.html" (
  echo Missing web\dist. Building...
  where pnpm >nul 2>&1
  if %errorlevel%==0 (
    pnpm build
  ) else (
    npm run build
  )
)

where pnpm >nul 2>&1
if %errorlevel%==0 (
  pnpm start
) else (
  npm run start
)

endlocal
