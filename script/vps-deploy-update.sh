#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/var/www/codeauditapp/codescope}"
PM2_APP_NAME="${PM2_APP_NAME:-codeauditapp}"
RUN_DB_PUSH="${RUN_DB_PUSH:-1}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "❌ App directory not found: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

echo "📍 Deploy directory: $(pwd)"

test -f package.json || { echo "❌ package.json not found in $(pwd)" >&2; exit 1; }
test -f package-lock.json || { echo "❌ package-lock.json not found in $(pwd)" >&2; exit 1; }
test -f .env || { echo "❌ .env not found in $(pwd)" >&2; exit 1; }

echo "🔄 Pulling latest changes..."
git pull --ff-only

echo "📦 Installing dependencies..."
npm ci

echo "🏗️ Building app..."
npm run build

echo "🌱 Loading env vars from .env..."
set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ "$RUN_DB_PUSH" == "1" ]]; then
  echo "🗄️ Applying database schema (db:push)..."
  npm run db:push
else
  echo "⏭️ Skipping db:push (RUN_DB_PUSH=$RUN_DB_PUSH)"
fi

echo "♻️ Restarting PM2 app: $PM2_APP_NAME"
pm2 restart "$PM2_APP_NAME" --update-env

echo "✅ Deployment complete. Quick checks:"
pm2 status "$PM2_APP_NAME"
curl -I http://127.0.0.1:5000 || true
