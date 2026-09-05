#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/wadnofei-membership"
APP_FILE="$APP_DIR/app.py"
TMP_FILE="/tmp/wadnofei-app.$$.py"
BACKUP_DIR="$APP_DIR/backups"
SERVICE="wadnofei-membership"
RAW="https://raw.githubusercontent.com/shumsphone96-sys/bunyan-platform/wadnofei-membership-deploy/deploy/wadnofei-membership/app.py"

ok(){ printf '\nOK: %s\n' "$1"; }
fail(){ printf '\nERROR: %s\n' "$1" >&2; exit 1; }
trap 'rm -f "$TMP_FILE"' EXIT

[ "$(id -u)" = "0" ] || fail "Run as root"
mkdir -p "$APP_DIR" "$BACKUP_DIR" "$APP_DIR/uploads" "$APP_DIR/qrs"

printf 'Downloading new version...\n'
curl -fsSL --retry 3 --connect-timeout 15 "$RAW" -o "$TMP_FILE"
[ -s "$TMP_FILE" ] || fail "Downloaded file is empty"

for route in "/change-password" "/payments" "/applications" "/apply" "/reports" "/verify/<token>"; do
  grep -q "$route" "$TMP_FILE" || fail "Missing route: $route"
done
python3 -m py_compile "$TMP_FILE" || fail "Python syntax check failed"
ok "Code verified"

STAMP="$(date +%Y%m%d-%H%M%S)"
[ -f "$APP_FILE" ] && cp -a "$APP_FILE" "$BACKUP_DIR/app-$STAMP.py"
[ -f "$APP_DIR/members.db" ] && cp -a "$APP_DIR/members.db" "$BACKUP_DIR/members-$STAMP.db"

install -m 0644 "$TMP_FILE" "$APP_FILE"
ok "New version installed and backup created"

systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" || { systemctl --no-pager -l status "$SERVICE" || true; fail "Service failed to start"; }

MAP="$($APP_DIR/venv/bin/python -c 'import sys;sys.path.insert(0,"/opt/wadnofei-membership");import app;print(app.app.url_map)' 2>/dev/null || true)"
for route in "/change-password" "/payments" "/applications" "/apply" "/reports"; do
  printf '%s' "$MAP" | grep -q "$route" || fail "Running app missing route: $route"
done

curl -fsS -o /dev/null http://127.0.0.1:8010/ || fail "App not responding on 8010"
ok "UPDATE COMPLETE"
printf 'Open: https://members.shamsphone.net\n'
printf 'Version: membership workflow + approval + card + QR + reports\n'
