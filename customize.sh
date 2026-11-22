ui_print " "
ui_print "     [Chibi Boost Activated] "
ui_print "     [Optimized Charging] "
ui_print "     [Thermal Shield ON] "
ui_print "     [Power Efficiency Mode Enabled]"
ui_print " "

ui_print "📦 Memulai instalasi mtk_idle_charging_magisk..."
ui_print "⚙️  Mengatur izin file untuk skrip..."
set_perm_recursive "$MODPATH/system/bin" 0 0 0755 0755

ui_print "📝 Mengatur izin service.sh..."
set_perm "$MODPATH/service.sh" 0 0 0755

ui_print "📝 Mengatur izin surfaceflinger_opt.sh..."
set_perm "$MODPATH/surfaceflinger_opt.sh" 0 0 0755
set_perm "$MODPATH/visual_tuner.sh" 0 0 0755
set_perm "$MODPATH/renderer_capabilities.sh" 0 0 0755
set_perm "$MODPATH/phase_tuner.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm_recursive "$MODPATH/config" 0 0 0755 0644

ui_print "🚀 Mengatur izin OC Engine (overclock_mt6789.ko)..."
if [ -f "$MODPATH/modules/overclock_mt6789.ko" ]; then
    set_perm "$MODPATH/modules/overclock_mt6789.ko" 0 0 0644
else
    ui_print "⚠️  overclock_mt6789.ko tidak ditemukan di paket, OC Engine akan skip saat boot."
fi

ui_print "🌐 Mengatur izin untuk folder webroot..."
set_perm_recursive "$MODPATH/webroot" 0 0 0755 0644

ui_print "Mengatur izin file init.rc..."
find "$MODPATH" -name "*.rc" | while read file; do
    set_perm "$file" 0 0 0644
done

# Preserve a valid previously saved phase profile on update.
OLD_PHASE="/data/adb/modules/mtk_idle_charging_magisk/config/phase_profile.txt"
if [ -f "$OLD_PHASE" ] && [ "$OLD_PHASE" != "$MODPATH/config/phase_profile.txt" ]; then
    IFS= read -r OLD_PROFILE < "$OLD_PHASE"
    case "$OLD_PROFILE" in
        rom|stable|balanced|latency)
            printf '%s\n' "$OLD_PROFILE" > "$MODPATH/config/phase_profile.txt"
            ui_print "Profil Pacing sebelumnya dipertahankan: $OLD_PROFILE"
            ;;
    esac
fi
# Preserve prior GPU/FPSGO/audio options; do not include stale logs in installer.
OLD_CACHE="/data/adb/modules/mtk_idle_charging_magisk/cache"
if [ -d "$OLD_CACHE" ]; then
    for name in last_applied_config.txt last_applied_dvfsrc_config.txt last_applied_fpsgo_config.txt last_applied_rendering_config.txt last_applied_resampler_config.txt last_applied_vcore_gpu_config.txt oc_baseline.json oc_gpu_stock.json; do
        if [ -f "$OLD_CACHE/$name" ] && [ ! -L "$OLD_CACHE/$name" ]; then
            cp -p "$OLD_CACHE/$name" "$MODPATH/cache/$name" 2>/dev/null || :
        fi
    done
fi
# Preserve user's old optional game labels/fallback across an upgrade.
OLD_GAMES="/data/adb/modules/mtk_idle_charging_magisk/webroot/games.json"
if [ -s "$OLD_GAMES" ] && [ "$OLD_GAMES" != "$MODPATH/webroot/games.json" ] && [ ! -L "$OLD_GAMES" ]; then
    cp "$OLD_GAMES" "$MODPATH/webroot/games.json" 2>/dev/null || :
    ui_print "Game JSON fallback lama dipertahankan."
fi
# ZENKU PQ Color: install permissions + preserve saved profiles across upgrades.
set_perm "$MODPATH/pq_tuner.sh" 0 0 0755
set_perm "$MODPATH/pq_autoboot.sh" 0 0 0755
set_perm_recursive "$MODPATH/bin" 0 0 0755 0644
for config in pq_profile.conf pq_custom.conf; do
    OLD_PQ="/data/adb/modules/mtk_idle_charging_magisk/config/$config"
    if [ -f "$OLD_PQ" ] && [ ! -L "$OLD_PQ" ] && [ "$OLD_PQ" != "$MODPATH/config/$config" ]; then
        cp "$OLD_PQ" "$MODPATH/config/$config" 2>/dev/null || :
    fi
done
# HIDL helper is shipped inside this ZIP: no Termux installation required.
# Never overwrite the verified bundled build with /data/local/tmp/ contents.
if [ ! -s "$MODPATH/bin/zenku-pqctl.jar" ]; then
    abort "ZENKU PQ: HIDL helper missing from ZIP. Installation stopped to avoid a broken WebRoot."
fi
set_perm "$MODPATH/bin/zenku-pqctl.jar" 0 0 0644
ui_print "PQ Color: HIDL helper v0.2 included (self-contained; no Termux dependency)."
ui_print "PQ Color: WebRoot page ready, PQ level range 4..9, autoboot OFF by default."

ui_print "ZENKU R5.4.15: Full Visual controls restored — AF Native/2/4/8/16, RGBA, Mali MSAA, Highp, AOSP MSAA."
ui_print "Profil ROM untuk rollback tersedia melalui tab Pacing."
ui_print "🎉 Instalasi selesai!"
ui_print "📦 Modul *mtk_idle_charging_magisk* siap digunakan!"
ui_print "⚡ Performa meningkat, suhu tetap adem 🔥"
