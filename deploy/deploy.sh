#!/bin/bash
set -euo pipefail

APP_PORT="${SITEMAP_EXPLORER_PORT:-4174}"
APP_NAME="sitemap-explorer"
APP_DIR="/var/www/sitemapExplorer"

cd "$APP_DIR"

echo "Installing dependencies..."
npm ci

echo "Building application..."
npm run build

echo "Starting/restarting backend on port $APP_PORT..."
PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env || PORT="$APP_PORT" pm2 start dist/server/server/index.js --name "$APP_NAME" --update-env

echo "Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx
