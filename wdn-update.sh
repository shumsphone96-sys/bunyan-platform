#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/wadnofei-membership"
APP_FILE="$APP_DIR/app.py"
TMP_FILE="/tmp/wadnofei-app.$$.py"
BACKUP_DIR="$APP_DIR/backups"
SERVICE="wadnofei-membership"
RAW="https://raw.githubusercontent.com/shumsphone96-sys/bunyan-platform/wadnofei-membership-deploy/deploy/wadnofei-membership/app.py"

ok(){ printf '\n✅ %s\n' "$1"; }
fail(){ printf '\n❌ %s\n' "$1" >&2; exit 1; }
trap 'rm -f "$TMP_FILE"' EXIT

[ "$(id -u)" = "0" ] || fail "شغّل التحديث بصلاحية root"
mkdir -p "$APP_DIR" "$BACKUP_DIR"

printf '⬇️  تنزيل النسخة الجديدة...\n'
curl -fsSL --retry 3 --connect-timeout 15 "$RAW" -o "$TMP_FILE"
[ -s "$TMP_FILE" ] || fail "الملف الجديد فارغ"

grep -q "@app.route('/change-password'" "$TMP_FILE" || fail "فشل التحقق: النسخة الجديدة غير مكتملة"
grep -q "@app.route('/payments'" "$TMP_FILE" || fail "فشل التحقق: مسار الاشتراكات غير موجود"
python3 -m py_compile "$TMP_FILE" || fail "فحص Python فشل"
ok "تم التحقق من الكود"

STAMP="$(date +%Y%m%d-%H%M%S)"
if [ -f "$APP_FILE" ]; then cp -a "$APP_FILE" "$BACKUP_DIR/app-$STAMP.py"; fi
if [ -f "$APP_DIR/members.db" ]; then cp -a "$APP_DIR/members.db" "$BACKUP_DIR/members-$STAMP.db"; fi

install -m 0644 "$TMP_FILE" "$APP_FILE"
ok "تم تثبيت النسخة الجديدة مع نسخة احتياطية"

systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" || { systemctl --no-pager -l status "$SERVICE" || true; fail "الخدمة لم تعمل"; }

MAP="$($APP_DIR/venv/bin/python -c 'import sys;sys.path.insert(0,"/opt/wadnofei-membership");import app;print(app.app.url_map)' 2>/dev/null || true)"
printf '%s' "$MAP" | grep -q '/change-password' || fail "الخدمة تعمل لكن النسخة الجديدة لم تُحمّل"
printf '%s' "$MAP" | grep -q '/payments' || fail "الخدمة تعمل لكن مسار الاشتراكات غير ظاهر"

curl -fsS -o /dev/null http://127.0.0.1:8010/ || fail "التطبيق لا يستجيب على 8010"
ok "التحديث اكتمل بنجاح"
printf '🌐 افتح: https://members.shamsphone.net\n'
printf '🔐 غيّر كلمة المرور من: تغيير كلمة المرور\n'
