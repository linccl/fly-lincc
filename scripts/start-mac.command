#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "Missing node_modules. Run: pnpm install (recommended) or npm install"
  read -r -p "Press Enter to exit..."
  exit 1
fi

if [[ ! -f "config/config.json" ]]; then
  echo "Missing config/config.json. Run:"
  echo "  pnpm set-password"
  echo "  (or: npm run set-password)"
  read -r -p "Press Enter to exit..."
  exit 1
fi

if [[ ! -f "web/dist/index.html" ]]; then
  echo "Missing web/dist. Building..."
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build
  else
    npm run build
  fi
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm start
else
  npm run start
fi
