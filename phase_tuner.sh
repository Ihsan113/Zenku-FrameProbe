#!/system/bin/sh
# ZENKU R5: boot-only phase profile selector for KernelSU WebUI / Termux.
# Call: /system/bin/sh phase_tuner.sh status|set {rom|stable|balanced|latency}|simulate [profile]
set -u
MOD=/data/adb/modules/mtk_idle_charging_magisk
CONF="$MOD/config/phase_profile.txt"
LAST="$MOD/cache/phase_last_profile.txt"
[ "$(id -u)" = 0 ] || { echo 'error=root_required'; exit 13; }
profile=balanced
if [ -f "$CONF" ]; then IFS= read -r profile < "$CONF"; fi
case "$profile" in rom|stable|balanced|latency) : ;; *) profile=balanced ;; esac
valid() { case "$1" in rom|stable|balanced|latency) return 0;; *) return 1;; esac; }
status() {
    echo "configured=$profile"
    if [ -f "$LAST" ]; then
        IFS= read -r last < "$LAST"
    else last=unknown; fi
    echo "last_boot=$last"
    echo "mode=$(getprop debug.sf.use_phase_offsets_as_durations)"
    echo "sdk=$(getprop ro.build.version.sdk)"
    echo "chipset=$(getprop ro.vendor.mediatek.platform)"
    echo "sf60_app=$(getprop ro.surface_flinger.vsync_event_phase_offset_ns)"
    echo "sf60_sf=$(getprop ro.surface_flinger.vsync_sf_event_phase_offset_ns)"
    echo "sf90_app=$(getprop debug.sf.high_fps_late_app_phase_offset_ns)"
    echo "sf90_sf=$(getprop debug.sf.high_fps_late_sf_phase_offset_ns)"
    echo "threshold=$(getprop debug.sf.phase_offset_threshold_for_next_vsync_ns)"
    echo 'dumpsys_begin=1'
    dumpsys SurfaceFlinger 2>/dev/null | grep -iE 'app phase:|app duration:|early app phase:|early app duration:|GL early app phase:|GL early app duration:|HWC min duration:' | head -7
    echo 'dumpsys_end=1'
}
case "${1:-status}" in
    status) status ;;
    set)
        new="${2:-}"
        valid "$new" || { echo 'error=invalid_profile'; exit 2; }
        [ -d "$MOD/config" ] || { echo 'error=module_not_installed'; exit 3; }
        printf '%s\n' "$new" > "$CONF.new.$$" || exit 4
        chmod 0644 "$CONF.new.$$" 2>/dev/null || :
        mv -f "$CONF.new.$$" "$CONF" || exit 5
        IFS= read -r check < "$CONF"
        [ "$check" = "$new" ] || { echo 'error=verify_failed'; exit 6; }
        echo "configured=$new"
        echo 'saved=1'
        echo 'reboot_required=1'
        echo 'note=No running SurfaceFlinger process was restarted or changed'
        ;;
    *) echo 'error=usage: status|set PROFILE'; exit 2 ;;
esac
