#!/usr/bin/env bash
# Build the portal and deploy it as the zabbix-portal service.
# Run as the zabbix user, NOT root:   ./build.sh
set -euo pipefail            # stop at the first error

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
JAR_NAME=zabbix-self-service-portal-1.0.0.jar
TARGET=/opt/zabbix-portal/portal.jar
PORT=${PORT:-8081}

if [[ $EUID -eq 0 ]]; then
  echo "Run this as the zabbix user, not root (root-owned build files break the next build)." >&2
  exit 1
fi

echo "==> 1/5 Building frontend"
cd "$APP_DIR/frontend"
[[ -f public/logo.svg ]] || echo "    note: no public/logo.svg, the default icon will be shown"
npm ci --no-audit --no-fund
npm run build:spring

echo "==> 2/5 Building backend"
cd "$APP_DIR/backend"
mvn -q clean package -DskipTests
JAR="$APP_DIR/backend/target/$JAR_NAME"
unzip -l "$JAR" | grep -q 'static/index.html' || { echo "Web pages missing from the JAR" >&2; exit 1; }

echo "==> 3/5 Installing (previous version kept as portal.jar.previous)"
if [[ -f "$TARGET" ]]; then sudo cp -p "$TARGET" "$TARGET.previous"; fi
sudo install -o root -g root -m 644 "$JAR" "$TARGET"

echo "==> 4/5 Restarting service"
sudo systemctl restart zabbix-portal

echo "==> 5/5 Checking it is up"
for i in {1..30}; do
  if out=$(curl -fs "http://127.0.0.1:$PORT/api/info"); then
    echo "OK: portal is running. $out"
    exit 0
  fi
  sleep 2
done

echo "Portal did not come up. Last log lines:" >&2
sudo journalctl -u zabbix-portal -n 40 --no-pager >&2
echo "To roll back: sudo cp $TARGET.previous $TARGET && sudo systemctl restart zabbix-portal" >&2
exit 1
