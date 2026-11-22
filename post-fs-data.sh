#!/system/bin/sh
# ZENKU AAA+++ R5.4 STABLE LAST PHASE ENGINE | Verified property policy for AOSP 13 / Helio G99.
# Apply before framework startup. Do not use setprop in post-fs-data.
# Sources: AOSP SurfaceFlinger.cpp, Scheduler/VsyncConfiguration.cpp,
#          HWUI Properties.cpp/.h, EGL, Magisk boot script guide.
# Do not change clocks, thermal limits or init services here.

MODULE_PATH="${0%/*}"
LOG_FILE="$MODULE_PATH/cache/boot.log"
CHECKPOINT_LOG="$MODULE_PATH/cache/checkpoint.log"
mkdir -p "$MODULE_PATH/cache"

log_message() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE"
}
checkpoint() {
    up=$(cut -d' ' -f1 /proc/uptime 2>/dev/null)
    printf '[%s | uptime=%ss] [POST-FS-DATA] %s\n' "$(date '+%H:%M:%S')" "$up" "$1" >> "$CHECKPOINT_LOG"
}

applied=0
failed=0
skipped=0
apply_prop() {
    key="$1"
    value="$2"
    if resetprop -n "$key" "$value" && [ "$(getprop "$key")" = "$value" ]; then
        applied=$((applied + 1))
        log_message "OK: $key=$value"
        return 0
    else
        failed=$((failed + 1))
        log_message "GAGAL: $key target=$value actual=$(getprop "$key")"
        return 1
    fi
}

# A positive vendor capability is necessary, but does not prove HAL consumption.
# Never overwrite ro.vendor.* support flags just to unlock a feature.
feature_on() {
    case "$(getprop "$1")" in
        1|true|y|yes|on) return 0 ;;
        *) return 1 ;;
    esac
}
any_feature_on() {
    for capability in "$@"; do
        feature_on "$capability" && return 0
    done
    return 1
}
skip_group() {
    skipped=$((skipped + 1))
    log_message "SKIP: $1"
}

checkpoint "=== POST-FS-DATA START ==="
log_message "=== ZENKU AAA+++ R5.4 STABLE LAST property tuning (AOSP 13 / MT6789) ==="
if ! command -v resetprop >/dev/null 2>&1; then
    log_message "GAGAL: resetprop tidak tersedia; konfigurasi runtime tidak diterapkan"
    checkpoint "=== POST-FS-DATA END (resetprop unavailable) ==="
    exit 0
fi

# LMKD modern memory-pressure policy (Android 13).
# The module's system.prop also declares these values; apply/read back here
# through resetprop before framework startup, matching the existing boot policy.
# kill_timeout_ms spaces consecutive kills; thrashing_limit_decay controls
# how far the threshold decays after the system fails to recover. No zRAM/swap
# configuration, oom_score_adj policy, CPU/GPU clock or thermal limit is changed.
# ZENKU R5.4.13 moderate LMKD pressure thresholds.
# AOSP high-performance baseline starting values; no ZRAM/VM/DVFSRC writes.
apply_prop ro.lmk.use_psi true
apply_prop ro.lmk.use_minfree_levels false
apply_prop ro.lmk.psi_partial_stall_ms 70
apply_prop ro.lmk.psi_complete_stall_ms 700
apply_prop ro.lmk.thrashing_limit 100
apply_prop ro.lmk.thrashing_limit_decay 10
apply_prop ro.lmk.swap_free_low_percentage 20
apply_prop ro.lmk.kill_heaviest_task true
apply_prop ro.lmk.kill_timeout_ms 100

# GameManager reads this when a game UID enters foreground on frameworks that
# implement the default-game-frame-rate override feature. Inert on frameworks
# that do not contain that implementation; does not unlock the game's own FPS cap.
apply_prop debug.graphics.game_default_frame_rate.disabled true

# PHH GSI headset-jack detection (restore from original AOSP Stable module).
# system.prop also includes this persistent property for boot-time consistency.
apply_prop persist.sys.overlay.devinputjack true

# 1. Renderer: deliberately preserve the original Skia GL priority.
apply_prop debug.hwui.renderer skiagl
apply_prop debug.renderengine.backend skiaglthreaded
# Google device configurations enable this Skia RenderThread task-splitting control.
apply_prop renderthread.skia.reduceopstasksplitting true
# Android 13 SurfaceFlinger reads this during startup. When supported blur layers
# are rendered, CompositionEngine can request higher GPU clocks for that work.
# It does not enable blur on builds that do not support background blur.
apply_prop ro.sf.blurs_are_expensive 1

# 2. ZENKU R5 PhaseOffset Engine (ROM baseline -> chosen manual profile).
# Verified previous ZENKU reference applied early via resetprop -n successfully.
# AOSP Scheduler/VsyncConfiguration.cpp: high-fps group if refresh period < 15 ms.
# Work-duration mode (1) must be disabled BEFORE any phase-offset property is written;
# WorkDuration::validateSysprops() rejects phase-offset props while mode 1 is active.
# ROM durations remain untouched, so profile 'rom' restores their use on reboot.
# SAFETY: mode is switched first and read back. Never toggle it back after phase props.
# Calculate budgets in model in docs/R5_FRAME_PACING_REPORT.md.
phase_profile=balanced
if [ -f "$MODULE_PATH/config/phase_profile.txt" ]; then
    IFS= read -r phase_profile < "$MODULE_PATH/config/phase_profile.txt"
fi
case "$phase_profile" in
    rom|stable|balanced|latency) : ;;
    *) log_message "R5: profil invalid [$phase_profile], fallback balanced"; phase_profile=balanced ;;
esac
phase_platform=$(getprop ro.vendor.mediatek.platform)
phase_sdk=$(getprop ro.build.version.sdk)
phase_boot_status=skipped
if [ "$phase_profile" = rom ]; then
    skip_group 'R5 Phase Engine: profil ROM, semua phase properties dipertahankan'
    phase_boot_status=rom
elif [ "$phase_platform" != MT6789 ] && [ "$phase_platform" != mt6789 ]; then
    skip_group "R5 Phase Engine: chipset [$phase_platform] bukan MT6789"
    phase_boot_status=platform_skip
elif [ "$phase_sdk" != 33 ]; then
    skip_group "R5 Phase Engine: Android SDK [$phase_sdk] bukan 33; timing ROM dipertahankan"
    phase_boot_status=sdk_skip
elif apply_prop debug.sf.use_phase_offsets_as_durations 0; then
    # All offsets in nanoseconds. 60Hz: 16,666,667ns; 90Hz: 11,111,111ns.
    # T=10ms is deliberately greater than EVERY configured SF offset (max 7.3ms),
    # preventing the N+2-vsync negative-offset path on 60/90Hz.
    case "$phase_profile" in
        stable)
            # Maximize slack for worst-case SF load; higher pipeline latency proxy.
            late_app=2100000; late_sf=3300000
            early_app=1500000; early_sf=2600000
            early_gl_app=1000000; early_gl_sf=1900000
            high_late_app=1700000; high_late_sf=2600000
            high_early_app=1200000; high_early_sf=2100000
            high_early_gl_app=850000; high_early_gl_sf=1600000
            ;;
        balanced)
            # Frame pacing for mixed 30/60/90 FPS game content on 60/90 Hz panel.
            late_app=4200000; late_sf=6200000
            early_app=3100000; early_sf=4700000
            early_gl_app=2250000; early_gl_sf=3550000
            high_late_app=3200000; high_late_sf=4300000
            high_early_app=2500000; high_early_sf=3450000
            high_early_gl_app=1800000; high_early_gl_sf=2650000
            ;;
        latency)
            # More aggressive scheduling. Use only after field measurements.
            late_app=5800000; late_sf=7300000
            early_app=4550000; early_sf=6150000
            early_gl_app=3450000; early_gl_sf=4900000
            high_late_app=4700000; high_late_sf=5900000
            high_early_app=3400000; high_early_sf=4500000
            high_early_gl_app=2600000; high_early_gl_sf=3550000
            ;;
    esac
    # Threshold is not timeout. Leave a single unambiguous N+1 path.
    phase_failed_before=$failed
    apply_prop ro.surface_flinger.vsync_event_phase_offset_ns "$late_app"
    apply_prop ro.surface_flinger.vsync_sf_event_phase_offset_ns "$late_sf"
    apply_prop debug.sf.early_app_phase_offset_ns "$early_app"
    apply_prop debug.sf.early_phase_offset_ns "$early_sf"
    apply_prop debug.sf.early_gl_app_phase_offset_ns "$early_gl_app"
    apply_prop debug.sf.early_gl_phase_offset_ns "$early_gl_sf"
    apply_prop debug.sf.high_fps_late_app_phase_offset_ns "$high_late_app"
    apply_prop debug.sf.high_fps_late_sf_phase_offset_ns "$high_late_sf"
    apply_prop debug.sf.high_fps_early_app_phase_offset_ns "$high_early_app"
    apply_prop debug.sf.high_fps_early_phase_offset_ns "$high_early_sf"
    apply_prop debug.sf.high_fps_early_gl_app_phase_offset_ns "$high_early_gl_app"
    apply_prop debug.sf.high_fps_early_gl_phase_offset_ns "$high_early_gl_sf"
    apply_prop debug.sf.phase_offset_threshold_for_next_vsync_ns 10000000
    if [ "$failed" -gt "$phase_failed_before" ]; then
        phase_boot_status=partial
        log_message 'R5 Phase Engine: beberapa properti gagal; jangan paksa work-duration=1 ketika offset manual sudah terset'
    else
        phase_boot_status=applied
    fi
    log_message "R5 Phase Engine: $phase_profile | 60Hz app=$late_app SF=$late_sf | 90Hz app=$high_late_app SF=$high_late_sf | threshold=10000000"
else
    phase_boot_status=mode_write_failed
    skip_group 'R5 Phase Engine: tidak dapat mengganti mode; tidak menulis phase offsets'
fi
printf '%s\n' "$phase_profile:$phase_boot_status" > "$MODULE_PATH/cache/phase_last_profile.txt"
checkpoint "R5 Phase Engine | profile=$phase_profile status=$phase_boot_status mode=[$(getprop debug.sf.use_phase_offsets_as_durations)]"

# 3. Composition: allow Hardware Composer to offload GPU when possible.
# Three acquired buffers: one extra vs AOSP default of two; not a global FPS unlock.
apply_prop ro.surface_flinger.max_frame_buffer_acquired_buffers 3
apply_prop ro.surface_flinger.use_context_priority true
# R5.4 STABLE LAST: Restore MT6789 vendor baseline (vendor/build.prop=1).
# R5.2 override=0 was experimental and caused potential frame-pacing regression.
apply_prop debug.sf.disable_backpressure 1
apply_prop debug.sf.enable_gl_backpressure 1
apply_prop debug.sf.predict_hwc_composition_strategy 1
# R5.4 STABLE LAST: Explicitly disable experimental R5.3 planner prediction.
apply_prop debug.sf.enable_planner_prediction 0
apply_prop debug.sf.disable_client_composition_cache 0
apply_prop debug.sf.enable_layer_caching 1
apply_prop debug.sf.layer_caching_active_layer_timeout_ms 500
# ZENKU R5.1 PILOT: PHH GSI vndk.rc can force debug.sf.latch_unsignaled=1
# when vendor.debug.sf.latch_unsignaled=1. Neutralize that trigger first,
# before SurfaceFlinger initialization. resetprop -n avoids property triggers.
# If the ROM/vendor reasserts the vendor flag later, verify after reboot.
if [ "$(getprop vendor.debug.sf.latch_unsignaled)" = 1 ]; then
    apply_prop vendor.debug.sf.latch_unsignaled 0
fi
# Android 13 AutoSingleLayer instead of Always: latch=0 + auto=true.
apply_prop debug.sf.latch_unsignaled 0
apply_prop debug.sf.auto_latch_unsignaled true
# AOSP reference is 80 ms. Experimental 60 ms allows a subsequent
# DISPLAY_UPDATE_IMMINENT hint sooner after display updates stop.
# Does not accelerate every rendered frame or guarantee higher game FPS.
apply_prop ro.surface_flinger.display_update_imminent_timeout_ms 60
apply_prop debug.sf.vsync_reactor_ignore_present_fences false
# atoi() expects 1, not true, for RenderEngine shader cache priming.
apply_prop service.sf.prime_shader_cache 1
apply_prop debug.sf.enable_adpf_cpu_hint true
# R5.4 STABLE LAST: Return PowerAdvisor early hint to AOSP default (disabled).
apply_prop debug.sf.send_early_power_session_hint 0
apply_prop debug.sf.enable_transaction_tracing 0

# 4. Responsive refresh policy, without falsely claiming a kernel idle timer.
# Keep active input refresh eligibility for 1.5 s; idle timeout 0.5 s.
apply_prop ro.surface_flinger.use_content_detection_for_refresh_rate true
apply_prop ro.surface_flinger.enable_frame_rate_override true
apply_prop ro.surface_flinger.set_touch_timer_ms 1500
apply_prop ro.surface_flinger.set_idle_timer_ms 500
apply_prop debug.sf.set_idle_timer_ms 500
apply_prop ro.surface_flinger.set_display_power_timer_ms 2000

# 5. Visual quality: native color management; no forced BT.2020 PQ or HDR.
# Managed mode corrects the original unmanaged (1) setting. No fake primaries.
# resetprop -n avoids property-service calls during this blocking boot stage.
apply_prop ro.surface_flinger.use_color_management true
apply_prop persist.sys.sf.native_mode 0
apply_prop persist.sys.sf.color_saturation 1.10
apply_prop persist.sys.sf.color_mode 0
apply_prop debug.sf.treat_170m_as_sRGB 0
# Actual AOSP blur support switch (GPU effect; quality-first, can cost GPU time).
apply_prop ro.surface_flinger.supports_background_blur 1
# Quality-first request: do not leave supported blur disabled by a stale setting.
# May add GPU load. Android can still disable blur under its own runtime policies.
apply_prop persist.sys.sf.disable_blurs 0

# 6. SurfaceFlinger scheduling floor (AOSP 13 setSchedAttr).
# 150/1024 = 14.65% scheduler utilization, NOT a fixed frequency or CPU load.
# Matches a public rock device-tree value; preserve a larger valid ROM floor.
# Source: frameworks/native/services/surfaceflinger/SurfaceFlinger.cpp.
if grep -q 'uclamp.min' /proc/self/sched 2>/dev/null; then
    sf_floor="$(getprop ro.surface_flinger.uclamp.min)"
    case "$sf_floor" in
        ''|*[!0-9]*) sf_floor=0 ;;
    esac
    if [ "$sf_floor" -ge 150 ] 2>/dev/null && [ "$sf_floor" -le 1024 ] 2>/dev/null; then
        log_message "PRESERVE: ROM SurfaceFlinger uclamp.min=$sf_floor"
    else
        apply_prop ro.surface_flinger.uclamp.min 150
    fi
else
    skip_group 'SurfaceFlinger uclamp: kernel support not visible'
fi

# 7. Native MTK picture-quality candidates, applied only on MT6789.
# Evidence: public rock vendor.prop (lineage-22.1, vendor BSP S0) and
# begonia-dev/android_device_redmi_begonia vendor.prop (14.0).
# rock reference advertises UltraRes, DRE30, Display Game PQ and TDSHP as 0.
# Do not fabricate support flags. On an unsupported or unknown feature, skip.
# PQ runtime values below are experimental; consumer binary is not verified.
case "$(getprop ro.vendor.mediatek.platform)" in
    MT6789|mt6789)
        # Both switches are carried by the actual rock device tree.
        # A vendor-specific optimization candidate, not a guaranteed FPS boost.
        apply_prop debug.mediatek.appgamepq_compress 1
        apply_prop debug.mediatek.disp_decompress 1

        case "$(getprop ro.vendor.mtk_pq_support)" in
            1|2|true)
                if any_feature_on ro.vendor.pq.mtk_disp_game_pq_support ro.vendor.mtk_appgamepq_support; then
                    apply_prop debug.mediatek.game_pq_enable 1
                else
                    skip_group 'Game PQ unsupported or unknown'
                fi
                # DRE contrast processing; no HDR path is forced.
                if any_feature_on ro.vendor.pq.mtk_dre30_support ro.vendor.mtk_dre30_support; then
                    apply_prop persist.vendor.sys.pq.mdp.dre.en 1
                    apply_prop persist.vendor.sys.pq.mdp.vp.dre.en 1
                else
                    skip_group 'DRE unsupported or unknown'
                fi
                if feature_on ro.vendor.pq.mtk_disp_tdshp_support; then
                    apply_prop vendor.debug.pq.shp.en 1
                    # Keep the ROM-calibrated sharpening index (not a strength range).
                else
                    skip_group 'Display sharpening unsupported or unknown'
                fi
                if feature_on ro.vendor.pq.mtk_ds_support; then
                    apply_prop vendor.debug.pq.dshp.en 1
                else
                    skip_group 'Dynamic sharpening unsupported or unknown'
                fi
                if feature_on ro.vendor.pq.mtk_ultra_resolution_support; then
                    # Original module used level 1; no documented MT6789 maximum.
                    apply_prop persist.vendor.sys.pq.ultrares.strength 1
                    apply_prop persist.vendor.sys.pq.ultrares.en 1
                else
                    skip_group 'UltraRes unsupported or unknown'
                fi
                ;;
            *) skip_group 'MTK PQ support not reported' ;;
        esac
        ;;
    *) skip_group 'MTK PQ: target MT6789 not reported' ;;
esac
# No fake HDR/HDR Vivid, PQ debugging, arbitrary color/sharpness indexes,
# or unvalidated Mali shader/texture driver overrides in this PQ section.
checkpoint "MTK PQ capability checks and SF scheduling done"

checkpoint "AFTER graphics policy | debug.hwui.renderer=[$(getprop debug.hwui.renderer)] debug.renderengine.backend=[$(getprop debug.renderengine.backend)]"

# 8. ART / DexOpt: public rock configuration + AOSP 13 runtime contract.
# No forced compilation, no change to boot-image or system_server compiler.
# Do not force a different architecture on 32-bit GSIs. Require actual binary.
if [ "$(getprop ro.build.version.sdk)" = 33 ]; then
    case "$(getprop ro.zygote)" in
        zygote64_32|zygote32_64|zygote64)
            if [ -x /apex/com.android.art/bin/dex2oat64 ]; then
                apply_prop dalvik.vm.dex2oat64.enabled true
            else
                skip_group '64-bit dex2oat executable unavailable'
            fi
            ;;
        *) skip_group '64-bit zygote not reported' ;;
    esac
    # Keep foreground big cores free while app dexopt runs. Verify MT6789
    # topology instead of assuming CPU numbering. Match thread count to mask.
    # Memory thresholds are conservative tuning candidates, not ROM defaults.
    case "$(getprop ro.vendor.mediatek.platform)" in
        MT6789|mt6789)
            little_mask=$(cat /sys/devices/system/cpu/cpu0/cpufreq/related_cpus 2>/dev/null)
            mem_kb=$(awk '/^MemTotal:/ {print $2; exit}' /proc/meminfo 2>/dev/null)
            case "$mem_kb" in ''|*[!0-9]*) mem_kb=0 ;; esac
            if [ "$little_mask" = '0 1 2 3 4 5' ] && [ "$mem_kb" -ge 3000000 ]; then
                # Preserve explicit ROM CPU policy (both fields are a pair).
                old_dex_cpus=$(getprop dalvik.vm.dex2oat-cpu-set)
                old_dex_threads=$(getprop dalvik.vm.dex2oat-threads)
                if [ -n "$old_dex_cpus" ] || [ -n "$old_dex_threads" ]; then
                    log_message "PRESERVE: ROM dexopt affinity=$old_dex_cpus threads=$old_dex_threads"
                else
                    if [ "$mem_kb" -ge 5000000 ]; then
                        apply_prop dalvik.vm.dex2oat-cpu-set 0,1,2,3,4,5
                        apply_prop dalvik.vm.dex2oat-threads 6
                    else
                        apply_prop dalvik.vm.dex2oat-cpu-set 0,1,2,3
                        apply_prop dalvik.vm.dex2oat-threads 4
                    fi
                fi
            else
                skip_group 'ART affinity: topology/RAM not confirmed'
            fi
            ;;
        *) skip_group 'ART affinity: not MT6789' ;;
    esac
else
    skip_group 'ART runtime policy: SDK is not Android 13'
fi
checkpoint "ART / DexOpt capability checks done"

# 9. R4 checkpoint: native MTK GPU filtering (OpenGL ES only).
# Verified with actual glGetTexParameter / glGetSamplerParameter on Mali-G57:
# AF 1 -> 4, min filter 0x2701 -> 0x2703; all GL errors 0.
# Not a measured FPS gain; the hook only replaces matching GL calls and can
# reduce an application's own AF level if it already requests >4x.
# GPUD process filter uses substring matching. Never set an empty target.
# Online game terms/anti-cheat compatibility is NOT established.
# Fixed boot default. WebUI edits are session-only, no visual cache or marker.
GPUD_TARGET_PACKAGE=com.mobile.legends
GPUD_EXPECTED_SHA=561f84e37814769b85facb52e330753db34ada69edac9dfe15573485bd8b8712

configure_gpud() {
    [ "$(getprop ro.build.version.sdk)" = 33 ] || return 1
    case "$(getprop ro.vendor.mediatek.platform)" in
        MT6789|mt6789) ;;
        *) return 1 ;;
    esac
    [ -r /vendor/lib64/libgpud.so ] || return 1
    [ -r /vendor/lib64/egl/mt6789/libGLES_mali.so ] || return 1
    gpud_sha=$(sha256sum /vendor/lib64/libgpud.so 2>/dev/null)
    [ "${gpud_sha%% *}" = "$GPUD_EXPECTED_SHA" ] || return 1
    mali_sha=$(sha256sum /vendor/lib64/egl/mt6789/libGLES_mali.so 2>/dev/null)
    [ "${mali_sha%% *}" = f1fb52d820be0a14baaeab7bf4ed9781c6be42470397e0bfee28681d194cfa13 ] || return 1
    [ "$GPUD_TARGET_PACKAGE" = com.mobile.legends ] || return 1
    # Disable before editing. Write the enable switch last, only after every
    # prerequisite and property has passed readback. Keep experimental hooks OFF.
    apply_prop vendor.debug.gpud.enable 0 || return 1
    apply_prop debug.gpu.enable 0 || return 1
    apply_prop debug.egl.force_msaa false || return 1
    apply_prop debug.gpu.force.highp 0 || return 1
    apply_prop vendor.debug.gpud.process.name "$GPUD_TARGET_PACKAGE" || return 1
    apply_prop vendor.debug.gpud.log 0 || return 1
    apply_prop vendor.debug.gpud.force.rgb8888.enable 0 || return 1
    apply_prop vendor.debug.gpud.egl.choose.config 0 || return 1
    apply_prop vendor.debug.gpud.gl.shadersource.hack 0 || return 1
    apply_prop vendor.debug.gpud.gl.tex.parameterf.target GL_TEXTURE_2D || return 1
    apply_prop vendor.debug.gpud.gl.tex.parameterf.pname GL_TEXTURE_MAX_ANISOTROPY_EXT || return 1
    apply_prop vendor.debug.gpud.gl.tex.parameterf.param 4.0 || return 1
    apply_prop vendor.debug.gpud.gl.sampler.parameterf.pname GL_TEXTURE_MAX_ANISOTROPY_EXT || return 1
    apply_prop vendor.debug.gpud.gl.sampler.parameterf.param 4.0 || return 1
    apply_prop vendor.debug.gpud.gl.tex.parameteri.target GL_TEXTURE_2D || return 1
    apply_prop vendor.debug.gpud.gl.tex.parameteri.pname GL_TEXTURE_MIN_FILTER || return 1
    apply_prop vendor.debug.gpud.gl.tex.parameteri.param GL_LINEAR_MIPMAP_LINEAR || return 1
    apply_prop vendor.debug.gpud.gl.sampler.parameteri.pname GL_TEXTURE_MIN_FILTER || return 1
    apply_prop vendor.debug.gpud.gl.sampler.parameteri.param GL_LINEAR_MIPMAP_LINEAR || return 1
    apply_prop vendor.debug.gpud.enable 1 || return 1
    return 0
}
if configure_gpud; then
    log_message 'R4: GPUD 4x AF + trilinear configured for MLBB (write/readback only)'
else
    apply_prop vendor.debug.gpud.enable 0
    skip_group 'R4 GPUD: prerequisites or property writes failed; requested OFF'
fi
checkpoint "R4 GPUD filter policy | enable=[$(getprop vendor.debug.gpud.enable)] target=[$(getprop vendor.debug.gpud.process.name)]"

# 10. MTK Display PQ checkpoint. Observed in visual_result.txt on this ROM:
# Color, gamma, CCORR and AAL support=1; supported bypass controls already 0.
# Preserve all calibrated PQ indices, HDR declarations and saturation from R3.
# No sharpening/gamma/contrast strength guesses before HAL investigation.
case "$(getprop ro.vendor.mediatek.platform)" in
    MT6789|mt6789)
        for pq_feature in color gamma ccorr aal; do
            case "$pq_feature" in
                aal) pq_support=ro.vendor.pq.mtk_aal_support ;;
                *) pq_support="ro.vendor.pq.mtk_disp_${pq_feature}_support" ;;
            esac
            pq_bypass="persist.vendor.sys.pq.disp.${pq_feature}.bypass"
            if feature_on "$pq_support" && [ -n "$(getprop "$pq_bypass")" ]; then
                if [ "$(getprop "$pq_bypass")" = 0 ]; then
                    log_message "PRESERVE: $pq_bypass=0"
                else
                    apply_prop "$pq_bypass" 0
                fi
            else
                skip_group "R4 PQ $pq_feature: support/control not reported"
            fi
        done
        # Native Vivid (picture mode 1), verified in the supplied PQ HAL binary.
        # Apply at boot, not a live HAL setter. Do not stack a second saturation boost.
        # resetprop -n: memory-only request; no persistent-storage option or profile cache.
        pq_hal=/vendor/lib64/hw/vendor.mediatek.hardware.pq@2.15-impl.so
        if feature_on ro.vendor.pq.mtk_disp_color_support && [ -r "$pq_hal" ]; then
            pq_hash=$(sha256sum "$pq_hal" 2>/dev/null)
            if [ "${pq_hash%% *}" = ddc5561ea671a25dd298f5c22d7756a20bb8a041a73d602d5af2cb3c4a5c593f ]; then
                apply_prop persist.vendor.sys.pq.picmode 1
                log_message 'R4: Vivid requested at boot; HAL application not measured'
            else
                skip_group 'R4 Vivid: PQ HAL hash mismatch'
            fi
        else
            skip_group 'R4 Vivid: display color unsupported or PQ HAL missing'
        fi
        # No independent dither support flag in the dump; preserve ROM setting.
        log_message "R4 PQ: preserve dither bypass=[$(getprop persist.vendor.sys.pq.disp.dither.bypass)]"
        ;;
    *) skip_group 'R4 PQ display: not MT6789' ;;
esac
checkpoint "R4 Display PQ checkpoint done"

# Original hardware detection retained (read-only).
log_message "Memeriksa kompatibilitas hardware..."
if [ ! -f /proc/mtk_battery_cmd/current_cmd ]; then
    log_message "Peringatan: File MTK idle charge tidak ditemukan"
else
    log_message "Hardware MTK terdeteksi dengan baik"
fi

# A successful property write is not evidence that a HAL or app consumes it.
log_message "=== Runtime properties: $applied OK, $failed GAGAL, $skipped groups SKIP (write/readback only) ==="
checkpoint "=== POST-FS-DATA END ==="
