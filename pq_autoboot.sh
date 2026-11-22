#!/system/bin/sh
# Only act when the user explicitly enabled PQ auto-reapply in WebRoot.
MODDIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
CONF="$MODDIR/config/pq_profile.conf"
[ -r "$CONF" ] || exit 0
[ "$(/system/bin/sed -n 's/^autoboot=//p' "$CONF" | /system/bin/head -n 1)" = 1 ] || exit 0
# Wait for Android Settings + SurfaceFlinger to stabilize. Bounded; no infinite loop.
i=0
while [ "$(getprop sys.boot_completed)" != 1 ] && [ "$i" -lt 90 ]; do
    /system/bin/sleep 2
    i=$((i+1))
done
[ "$(getprop sys.boot_completed)" = 1 ] || exit 0
/system/bin/sleep 8
/system/bin/sh "$MODDIR/pq_tuner.sh" apply-saved >> "$MODDIR/cache/pq_boot.log" 2>&1
