#!/usr/bin/env bash
# Script deploy cho Website VNPT công khai (marketing) trên server dùng PM2 (chưa có BE riêng).
# Cách dùng: ./deploy.sh   (chạy trên server, trong thư mục project)
# Tự động: pull code mới -> install -> dừng app cũ -> build -> start/restart qua PM2.
#
# Lưu ý: dừng app cũ TRƯỚC khi build (không build song song với app đang chạy)
# để tránh lỗi 500 do app cũ đọc phải file .next đang bị build mới ghi đè dở dang.
#
# Port 8087 (CRM frontend dùng 8086, chọn port khác để chạy song song).

set -e

PORT=8087
APP_NAME="vnpt-web-cong-khai"

BEFORE_COMMIT=$(git rev-parse HEAD)

echo "==> Pulling latest code..."
git pull

AFTER_COMMIT=$(git rev-parse HEAD)

if git diff --name-only "$BEFORE_COMMIT" "$AFTER_COMMIT" | grep -qE "^(package\.json|package-lock\.json)$"; then
  echo "==> package.json changed, installing dependencies..."
  npm install
else
  echo "==> package.json unchanged, skipping npm install."
fi

echo "==> Stopping app (if running) before build..."
pm2 stop "$APP_NAME" > /dev/null 2>&1 || echo "==> App not running yet, skipping stop."

echo "==> Building production..."
npm run build

echo "==> Starting/restarting app via PM2 on port $PORT..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  PORT=$PORT pm2 start npm --name "$APP_NAME" -- start
fi
pm2 save

echo "==> Waiting for server to respond on port $PORT..."
READY=0
for i in $(seq 1 15); do
  if curl -s -o /dev/null -m 2 "http://localhost:$PORT/"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 1 ]; then
  echo "==> Done. App is running again on port $PORT (pm2 name: $APP_NAME)."
else
  echo "==> ERROR: server did not respond on port $PORT after 15s. Last logs:"
  pm2 logs "$APP_NAME" --lines 30 --nostream
  exit 1
fi

echo "==> Check logs with: pm2 logs $APP_NAME"
