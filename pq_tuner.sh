#!/system/bin/sh
# ZENKU R5.4.3: Opt-in MT6789 PQ + Android color mode + SurfaceFlinger UI bridge.
# This command runs as root through KernelSU WebUI or module service.sh.
# NO gamma, GlobalPQ, SELinux policy changes, or kernel/display restarts.
set -u
MODDIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
CONF="$MODDIR/config/pq_profile.conf"
CUSTOM="$MODDIR/config/pq_custom.conf"
LOCK="$MODDIR/cache/.pq_apply_lock"
# Use the self-contained, verified HIDL helper embedded in the module first.
BIN="$MODDIR/bin/zenku-pqctl.jar"
# Legacy recovery fallback only if the packaged JAR was removed or damaged.
[ -s "$BIN" ] || BIN=/data/local/tmp/zenku-pqctl.jar
PATH=/system/bin:/system/xbin:/vendor/bin:/product/bin:$PATH
export PATH

err() { echo "error=$*" >&2; exit 2; }
valid_level() { case "$1" in 4|5|6|7|8|9) return 0;; esac; return 1; }
valid_mode() { case "$1" in boosted|automatic) return 0;; esac; return 1; }
valid_sf() { case "$1" in 1.00|1.05|1.10|1.15|1.20|1.25|1.30) return 0;; esac; return 1; }
valid_autoboot() { [ "$1" = 0 ] || [ "$1" = 1 ]; }
valid_profile() { case "$1" in natural|balanced|vivid|custom|baseline) return 0;; esac; return 1; }
read_cfg() { [ -r "$1" ] && /system/bin/sed -n "s/^$2=//p" "$1" | /system/bin/head -n 1 || true; }
read_conf() { read_cfg "$CONF" "$1"; }
check_root() { [ "$(id -u)" = 0 ] || err 'Hanya akses root KernelSU/Magisk yang diizinkan.'; }
check_hal() { [ -s "$BIN" ] || err 'JAR HIDL bawaan modul tidak ditemukan. Instal ulang ZIP ZENKU R5.4.4.'; }
hal() { CLASSPATH="$BIN" /system/bin/app_process /system/bin ZENKUPqCtl "$@"; }
read_color() { hal color 0 1; }
index_of() { printf '%s\n' "$1" | /system/bin/sed -n "s/^  $2=//p" | /system/bin/head -n 1; }
read_hal_values() {
    PQ_READ="$(read_color 2>&1)" || { echo "$PQ_READ" >&2; return 1; }
    PV_SAT="$(index_of "$PQ_READ" SatGain)"
    PV_CON="$(index_of "$PQ_READ" Contrast)"
    PV_BRI="$(index_of "$PQ_READ" Brightness)"
    case "$PV_CON:$PV_SAT:$PV_BRI" in *[!0-9:]*|::|:*) return 1;; esac
    [ -n "$PV_CON" ] && [ -n "$PV_SAT" ] && [ -n "$PV_BRI" ] || return 1
}
lock() {
    /system/bin/mkdir -p "$MODDIR/cache"
    /system/bin/mkdir "$LOCK" 2>/dev/null || err 'PQ sedang diproses; coba lagi setelah operasi selesai.'
    trap '/system/bin/rmdir "$LOCK" 2>/dev/null || true' EXIT HUP INT TERM
}
write_cfg() {
    target="$1"; tmp="$target.tmp.$$"
    {
        printf 'profile=%s\n' "$PROFILE"
        printf 'contrast=%s\n' "$CON"
        printf 'saturation=%s\n' "$SAT"
        printf 'brightness=%s\n' "$BRI"
        printf 'mode=%s\n' "$MODE"
        printf 'sf=%s\n' "$SF"
        printf 'autoboot=%s\n' "$AUTO"
    } > "$tmp" || return 1
    /system/bin/chmod 600 "$tmp"
    /system/bin/mv -f "$tmp" "$target"
}
rollback_hal() {
    # Best-effort rollback using values sampled before first write (not a factory reset).
    [ -n "${BEFORE_CON:-}" ] && hal set contrast "$BEFORE_CON" --apply >/dev/null 2>&1 || true
    [ -n "${BEFORE_SAT:-}" ] && hal set saturation "$BEFORE_SAT" --apply >/dev/null 2>&1 || true
    [ -n "${BEFORE_BRI:-}" ] && hal set brightness "$BEFORE_BRI" --apply >/dev/null 2>&1 || true
}
apply_internal() {
    PROFILE="$1"; CON="$2"; SAT="$3"; BRI="$4"; MODE="$5"; SF="$6"; AUTO="$7"; IS_BOOT="${8:-0}"
    valid_profile "$PROFILE" || err 'Profil tidak valid.'
    valid_level "$CON" && valid_level "$SAT" && valid_level "$BRI" || err 'LEVEL PQ HARUS 4..9. Batas maksimal 9 berlaku untuk kontras, saturasi, brightness.'
    valid_mode "$MODE" || err 'Mode Android harus boosted/automatic.'
    valid_sf "$SF" || err 'SF hanya 1.00..1.30 dengan langkah 0.05.'
    valid_autoboot "$AUTO" || err 'Autoboot harus 0/1.'
    check_root; check_hal; lock
    read_hal_values || err 'Gagal membaca profil HAL. Tidak ada nilai yang diubah.'
    BEFORE_CON="$PV_CON"; BEFORE_SAT="$PV_SAT"; BEFORE_BRI="$PV_BRI"
    BEFORE_MODE="$(settings get system display_color_mode 2>/dev/null | /system/bin/tail -n 1)"
    [ "$IS_BOOT" = 1 ] || {
        BACKUP="$MODDIR/cache/pq_before_$(date +%Y%m%d_%H%M%S)_$$.txt"
        {
            echo "before_contrast=$BEFORE_CON"
            echo "before_saturation=$BEFORE_SAT"
            echo "before_brightness=$BEFORE_BRI"
            echo "before_android_mode=$BEFORE_MODE"
            echo "before_sf_property=$(getprop persist.sys.sf.color_saturation)"
            echo "before_config_profile=$(read_conf profile)"
        } > "$BACKUP"
        /system/bin/chmod 600 "$BACKUP"
        echo "snapshot=$BACKUP"
    }
    # Values validated above; v0.2 HIDL CLI accepts 0..21 but THIS controller enforces <=9.
    if ! hal set contrast "$CON" --apply >/dev/null 2>&1 ||
       ! hal set saturation "$SAT" --apply >/dev/null 2>&1 ||
       ! hal set brightness "$BRI" --apply >/dev/null 2>&1; then
        rollback_hal
        err 'Penulisan HAL gagal; rollback indeks sebelumnya telah dicoba.'
    fi
    if ! read_hal_values || [ "$PV_CON" != "$CON" ] || [ "$PV_SAT" != "$SAT" ] || [ "$PV_BRI" != "$BRI" ]; then
        rollback_hal
        err 'Readback HAL berbeda; rollback indeks sebelumnya telah dicoba.'
    fi
    case "$MODE" in boosted) ANDROID_MODE=1;; automatic) ANDROID_MODE=3;; esac
    if ! settings put system display_color_mode "$ANDROID_MODE" >/dev/null 2>&1; then
        rollback_hal
        err 'Gagal mengatur display_color_mode; PQ rollback dicoba.'
    fi
    # After Android color mode, send explicit SF saturation (NOT additive with Boosted).
    /system/bin/sleep 1
    SF_OUT="$(service call SurfaceFlinger 1022 f "$SF" 2>&1)"; SF_CODE=$?
    if [ "$SF_CODE" -ne 0 ]; then
        rollback_hal
        case "$BEFORE_MODE" in 1|3) settings put system display_color_mode "$BEFORE_MODE" >/dev/null 2>&1 || true;; esac
        err 'Transaksi SF gagal; PQ dan mode dipulihkan sebisanya.'
    fi
    if [ "$IS_BOOT" != 1 ]; then
        if [ "$PROFILE" = custom ]; then write_cfg "$CUSTOM" || err 'Gagal menyimpan template Custom.'; fi
        write_cfg "$CONF" || err 'Gagal menyimpan profil aktif.'
    fi
    echo 'applied=1'
    echo "profile=$PROFILE"
    echo "contrast=$CON"
    echo "saturation=$SAT"
    echo "brightness=$BRI"
    echo "mode=$MODE"
    echo "sf_requested=$SF"
    echo "sf_transaction=$SF_OUT"
    echo "autoboot=$AUTO"
    echo 'note=HAL readback cocok. SF request dikirim; efek visual tetap diperiksa di layar.'
}
status() {
    check_root
    echo 'bridge=zenku-pq-v1'
    echo "jar_ready=$([ -s "$BIN" ] && echo 1 || echo 0)"
    echo "profile=$(read_conf profile)"
    echo "config_contrast=$(read_conf contrast)"
    echo "config_saturation=$(read_conf saturation)"
    echo "config_brightness=$(read_conf brightness)"
    echo "config_mode=$(read_conf mode)"
    echo "config_sf=$(read_conf sf)"
    echo "autoboot=$(read_conf autoboot)"
    for k in contrast saturation brightness mode sf; do
        echo "custom_$k=$(read_cfg "$CUSTOM" "$k")"
    done
    echo "android_mode=$(settings get system display_color_mode 2>/dev/null | /system/bin/tail -n 1)"
    echo "sf_property=$(getprop persist.sys.sf.color_saturation)"
    echo "pq_picmode=$(getprop persist.vendor.sys.pq.picmode)"
    if [ -s "$BIN" ] && read_hal_values; then
        echo 'hal_ok=1'
        echo "live_contrast=$PV_CON"
        echo "live_saturation=$PV_SAT"
        echo "live_brightness=$PV_BRI"
    else
        echo 'hal_ok=0'
        echo 'warning=HAL tidak bisa dibaca. Periksa root, JAR dan service PQ.'
    fi
}
usage() {
    echo 'ZENKU PQ webroot bridge v1'
    echo '  pq_tuner.sh status'
    echo '  pq_tuner.sh apply <natural|balanced|vivid|custom> <contrast 4..9> <saturation 4..9> <brightness 4..9> <boosted|automatic> <sf 1.00..1.30 step .05> <autoboot 0|1>'
    echo '  pq_tuner.sh restore              # restore to tested baseline 4/4/4, Boosted + SF 1.10; disable autoboot'
    echo '  pq_tuner.sh apply-saved          # boot only; honors autoboot=1'
}
case "${1:-help}" in
    status) [ "$#" = 1 ] || err 'status tidak menerima argumen'; status;;
    apply) [ "$#" = 8 ] || err 'Jumlah argumen apply salah'; shift; apply_internal "$@" 0;;
    restore) [ "$#" = 1 ] || err 'restore tidak menerima argumen'; apply_internal baseline 4 4 4 boosted 1.10 0 0;;
    apply-saved)
        [ "$#" = 1 ] || err 'apply-saved tidak menerima argumen'
        [ "$(read_conf autoboot)" = 1 ] || { echo 'skipped=autoboot_off'; exit 0; }
        apply_internal "$(read_conf profile)" "$(read_conf contrast)" "$(read_conf saturation)" "$(read_conf brightness)" "$(read_conf mode)" "$(read_conf sf)" 1 1;;
    help|--help) usage;;
    *) err 'Perintah tidak dikenal.';;
esac
