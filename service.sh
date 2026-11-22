#!/system/bin/sh

# Module ID
MODULE_ID="mtk_idle_charging_magisk"


# File path to save the last GPU configuration
LAST_APPLIED_GPU_CONFIG_PATH="/data/adb/modules/${MODULE_ID}/cache/last_applied_config.txt"
# File path to save the last Rendering Backend configuration
LAST_APPLIED_RENDERING_CONFIG_PATH="/data/adb/modules/${MODULE_ID}/cache/last_applied_rendering_config.txt"
# File path to save the last FPSGO configuration
LAST_APPLIED_FPSGO_CONFIG_PATH="/data/adb/modules/${MODULE_ID}/cache/last_applied_fpsgo_config.txt"
# File path to save the last VCore DVFS & GPU DVFS configuration
LAST_APPLIED_VCORE_GPU_CONFIG_PATH="/data/adb/modules/${MODULE_ID}/cache/last_applied_vcore_gpu_config.txt"
# File path untuk save config DVFSRC
LAST_APPLIED_DVFSRC_CONFIG_PATH="/data/adb/modules/${MODULE_ID}/cache/last_applied_dvfsrc_config.txt"

# GPU file paths
GPU_FIX_TARGET_OPP_INDEX_PATH="/proc/gpufreqv2/fix_target_opp_index"
GPU_FIX_FREQ_PATH="/proc/gpufreqv2/fix_custom_freq_volt"

# --- DVFSRC Memory Tuning Constants ---
DVFSRC_GOVERNOR_PATH="/sys/class/devfreq/mtk-dvfsrc-devfreq/governor"
DVFSRC_MIN_FREQ_PATH="/sys/class/devfreq/mtk-dvfsrc-devfreq/min_freq"
DVFSRC_MAX_FREQ_PATH="/sys/class/devfreq/mtk-dvfsrc-devfreq/max_freq"

# Values for GPU reset
RESET_VALUE="-1"
RESET_FIX_FREQ_VOLT_VALUE="0 0"

# --- Rendering Backend Constants ---
HWUI_RENDERER_PROP="debug.hwui.renderer"
RENDERENGINE_BACKEND_PROP="debug.renderengine.backend"

# --- FPSGO Constants ---
FPSGO_ENABLE_PATH="/sys/kernel/fpsgo/common/fpsgo_enable"
FSTB_SELF_CTRL_FPS_ENABLE_PATH="/sys/kernel/fpsgo/fstb/fstb_self_ctrl_fps_enable"
FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH="/sys/module/mtk_fpsgo/parameters/fstb_target_fps_margin_high_fps"
FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH="/sys/module/mtk_fpsgo/parameters/fstb_target_fps_margin_low_fps"
FSTB_SET_RENDER_MAX_FPS_PATH="/sys/kernel/fpsgo/fstb/set_render_max_fps"

# --- NEW VCore DVFS & GPU DVFS Constants ---
HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH="/sys/kernel/helio-dvfsrc/dvfsrc_force_vcore_dvfs_opp"
GED_GPU_DVFS_ENABLE_PATH="/sys/module/ged/parameters/gpu_dvfs_enable"

# Default values untuk DVFSRC
DVFSRC_DEFAULT_GOVERNOR="simple_ondemand"
DVFSRC_DEFAULT_MIN_FREQ="800000000"
DVFSRC_DEFAULT_MAX_FREQ="4266000000"

# Default values for VCore DVFS & GPU DVFS (for reset/no config found)
VCORE_DVFS_BOOT_DEFAULT_VALUE="255" # As per user's request for reset value
GPU_DVFS_BOOT_DEFAULT_VALUE="1"     # Default: enabled (dynamic)


# --- Logging Functions ---
log_info() {
    echo "[GPU_FREQ_BOOT] $1" >> /dev/kmsg
    echo "[GPU_FREQ_BOOT] $1"
}

log_error() {
    echo "[GPU_FREQ_BOOT_ERROR] $1" >> /dev/kmsg
    echo "[GPU_FREQ_BOOT_ERROR] $1" >&2
}

# --- Shared checkpoint log (dipakai bareng post-fs-data.sh & surfaceflinger_opt.sh) ---
CHECKPOINT_LOG="/data/adb/modules/${MODULE_ID}/cache/checkpoint.log"
checkpoint() {
    up=$(cut -d' ' -f1 /proc/uptime 2>/dev/null)
    echo "[$(date '+%H:%M:%S') | uptime=${up}s] [SERVICE] $1" >> "$CHECKPOINT_LOG"
    sync
}
checkpoint "=== SERVICE.SH START ==="

# --- Function to write to /proc or /sys file (with permissions) ---
write_to_param_file() {
    local file_path="$1"
    local data="$2"
    if [ -f "$file_path" ]; then
        # Try to change permissions if possible and needed
        chmod 644 "$file_path" 2>/dev/null || true # Ignore chmod errors
        echo -n "$data" > "$file_path"
        chmod 444 "$file_path" 2>/dev/null || true # Ignore chmod errors
        log_info "Successfully wrote '$data' to $file_path"
    else
        log_error "File not found: $file_path"
    fi
}

# --- Function to set system property ---
set_system_property() {
    local prop_name="$1"
    local value="$2"

    if [ "$value" = "default" ] || [ -z "$value" ]; then
        checkpoint "RESET ${prop_name} | before=[$(getprop "$prop_name")]"
        resetprop "$prop_name"
        sync
        checkpoint "RESET ${prop_name} | after=[$(getprop "$prop_name")]"
        log_info "Resetting system property ${prop_name}."
    else
        checkpoint "SET ${prop_name} | before=[$(getprop "$prop_name")] target=${value}"
        setprop "$prop_name" "$value"
        sync
        checkpoint "SET ${prop_name} | after=[$(getprop "$prop_name")]"
        log_info "Setting system property ${prop_name} to '${value}'."
    fi
}


# Make sure the cache directory exists for all configurations
mkdir -p /data/adb/modules/${MODULE_ID}/cache/

# --- Existing Section (Universal Cleanup & GPU Frequency) ---
checkpoint "BEFORE universal GPU cleanup"
log_info "Performing universal cleanup of previous GPU settings..."
write_to_param_file "$GPU_FIX_TARGET_OPP_INDEX_PATH" "$RESET_VALUE"
write_to_param_file "$GPU_FIX_FREQ_PATH" "$RESET_FIX_FREQ_VOLT_VALUE"
log_info "Universal cleanup of GPU settings complete."
checkpoint "AFTER universal GPU cleanup"

log_info "Starting application of last GPU configuration during boot..."

last_gpu_config=""
if [ -f "$LAST_APPLIED_GPU_CONFIG_PATH" ]; then
    last_gpu_config=$(cat "$LAST_APPLIED_GPU_CONFIG_PATH" | tr -d '\n\r')
    if [ -z "$last_gpu_config" ]; then
        log_info "Last GPU configuration file ($LAST_APPLIED_GPU_CONFIG_PATH) is empty. Assuming reset."
        last_gpu_config="reset_auto"
    else
        log_info "Last GPU configuration found: $last_gpu_config"
    fi
else
    log_info "No last GPU configuration file found at $LAST_APPLIED_GPU_CONFIG_PATH. Assuming reset."
    last_gpu_config="reset_auto"
fi

case "$last_gpu_config" in
    fixed_freq=*)
        freq_volt=$(echo "$last_gpu_config" | sed 's/^fixed_freq=//')
        log_info "Applying fixed GPU mode: $freq_volt"
        write_to_param_file "$GPU_FIX_FREQ_PATH" "$freq_volt"
        ;;
    custom_opp_index=*)
        opp_index=$(echo "$last_gpu_config" | sed 's/^custom_opp_index=//')
        log_info "Applying custom GPU mode: Index $opp_index"
        write_to_param_file "$GPU_FIX_TARGET_OPP_INDEX_PATH" "$opp_index"
        ;;
    reset_auto)
        log_info "GPU reset_auto mode detected. No additional action needed as universal cleanup has been performed."
        ;;
    *)
        log_error "Last GPU configuration is invalid or unrecognized: $last_gpu_config"
        log_error "No additional action for GPU as universal cleanup has been performed."
        ;;
esac

log_info "GPU configuration application complete."
checkpoint "AFTER GPU config case-block application"

# --- Addition from previous code (battery_cmd) ---
if [ -f /proc/mtk_battery_cmd/current_cmd ]; then
    echo 0 0 > /proc/mtk_battery_cmd/current_cmd
    log_info "Setting /proc/mtk_battery_cmd/current_cmd to 0 0"
fi
# --- End of addition from previous code ---


# --- New Section for Rendering Backend ---
log_info "Starting application of last Rendering Backend configuration during boot..."
checkpoint "BEFORE Rendering Backend section | SF_PID=$(pidof surfaceflinger) SF_STATUS=$(getprop init.svc.surfaceflinger)"

if [ -f "$LAST_APPLIED_RENDERING_CONFIG_PATH" ]; then
    last_rendering_config=$(cat "$LAST_APPLIED_RENDERING_CONFIG_PATH")
    if [ -z "$last_rendering_config" ]; then
        log_info "Last Rendering Backend configuration file ($LAST_APPLIED_RENDERING_CONFIG_PATH) is empty. Assuming reset."
        # Perform property reset if the file is empty
        set_system_property "$HWUI_RENDERER_PROP" ""
        set_system_property "$RENDERENGINE_BACKEND_PROP" ""
    else
        log_info "Last Rendering Backend configuration found."
        # Parse and apply each configuration line
        echo "$last_rendering_config" | while IFS='=' read -r prop_key prop_value; do
            case "$prop_key" in
                hwui)
                    set_system_property "$HWUI_RENDERER_PROP" "$prop_value"
                    ;;
                renderengine)
                    set_system_property "$RENDERENGINE_BACKEND_PROP" "$prop_value"
                    ;;
                *)
                    log_error "Unrecognized rendering property: $prop_key"
                    ;;
            esac
        done
    fi
else
    log_info "No last Rendering Backend configuration file found at $LAST_APPLIED_RENDERING_CONFIG_PATH. Assuming reset."
    # Perform property reset if the file does not exist
    set_system_property "$HWUI_RENDERER_PROP" ""
    set_system_property "$RENDERENGINE_BACKEND_PROP" ""
fi

log_info "Rendering Backend configuration application complete."
checkpoint "AFTER Rendering Backend section | SF_PID=$(pidof surfaceflinger) SF_STATUS=$(getprop init.svc.surfaceflinger)"




# --- New Section for Audio Resampler Quality (af.resampler.quality) ---
# Plain property (not persist.*), wiped every reboot like the others above.
LAST_APPLIED_RESAMPLER_CONFIG_PATH="/data/adb/modules/${MODULE_ID}/cache/last_applied_resampler_config.txt"

checkpoint "BEFORE Audio Resampler section (spawns backgrounded subshell, does not block)"
if [ -f "$LAST_APPLIED_RESAMPLER_CONFIG_PATH" ]; then
    last_resampler_quality=$(cat "$LAST_APPLIED_RESAMPLER_CONFIG_PATH")
    if [ -n "$last_resampler_quality" ]; then
        # Eksekusi dilempar ke background agar proses boot utama tidak tertahan
        (
            # Tunggu 15 detik sampai HP selesai booting & masuk homescreen
            sleep 15 
            
            # Terapkan properti resampler
            setprop af.resampler.quality "$last_resampler_quality"
            
            # Beri jeda 2 detik lagi sebelum membunuh audioserver agar sistem stabil
            sleep 2
            pkill -f audioserver 2>/dev/null
            
            log_info "Audio resampler quality reapplied safely after boot: ${last_resampler_quality}."
        ) &
    fi
else
    log_info "No audio resampler quality cache found. Skipping."
fi
checkpoint "AFTER Audio Resampler section (dispatch only, subshell runs later)"



# --- New Section for FPSGO ---
checkpoint "BEFORE FPSGO section"
log_info "Starting application of last FPSGO configuration during boot..."

if [ -f "$LAST_APPLIED_FPSGO_CONFIG_PATH" ]; then
    last_fpsgo_config=$(cat "$LAST_APPLIED_FPSGO_CONFIG_PATH")
    if [ -z "$last_fpsgo_config" ]; then
        log_info "Last FPSGO configuration file ($LAST_APPLIED_FPSGO_CONFIG_PATH) is empty. Assuming reset."
        # If the file is empty, apply default FPSGO values
        write_to_param_file "$FPSGO_ENABLE_PATH" "1"
        write_to_param_file "$FSTB_SELF_CTRL_FPS_ENABLE_PATH" "1"
        write_to_param_file "$FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH" "5"
        write_to_param_file "$FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH" "3"
        write_to_param_file "$FSTB_SET_RENDER_MAX_FPS_PATH" "60"
    else
        log_info "Last FPSGO configuration found."
        # Parse and apply each configuration line
        echo "$last_fpsgo_config" | while IFS='=' read -r file_path_raw value; do
            # The path stored in the config file is already the full path
            file_path=$(echo "$file_path_raw" | sed 's/\\//g') # Remove backslashes if any (from JS escaping)
            write_to_param_file "$file_path" "$value"
        done
    fi
else
    log_info "No last FPSGO configuration file found at $LAST_APPLIED_FPSGO_CONFIG_PATH. Assuming reset."
    # If there is no file, apply default FPSGO values
    write_to_param_file "$FPSGO_ENABLE_PATH" "1"
    write_to_param_file "$FSTB_SELF_CTRL_FPS_ENABLE_PATH" "1"
    write_to_param_file "$FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH" "5"
    write_to_param_file "$FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH" "3"
    write_to_param_file "$FSTB_SET_RENDER_MAX_FPS_PATH" "60"
fi

log_info "FPSGO configuration application complete."
checkpoint "AFTER FPSGO section"


# --- New Section for VCore DVFS & GPU DVFS ---
checkpoint "BEFORE VCore DVFS & GPU DVFS section"
log_info "Starting application of last VCore DVFS & GPU DVFS configuration during boot..."

if [ -f "$LAST_APPLIED_VCORE_GPU_CONFIG_PATH" ]; then
    last_vcore_gpu_config=$(cat "$LAST_APPLIED_VCORE_GPU_CONFIG_PATH")
    if [ -z "$last_vcore_gpu_config" ]; then
        log_info "Last VCore DVFS & GPU DVFS configuration file ($LAST_APPLIED_VCORE_GPU_CONFIG_PATH) is empty. Applying default values."
        write_to_param_file "$HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH" "$VCORE_DVFS_BOOT_DEFAULT_VALUE"
        write_to_param_file "$GED_GPU_DVFS_ENABLE_PATH" "$GPU_DVFS_BOOT_DEFAULT_VALUE"
    else
        log_info "Last VCore DVFS & GPU DVFS configuration found."
        echo "$last_vcore_gpu_config" | while IFS='=' read -r file_path_raw value; do
            file_path=$(echo "$file_path_raw" | sed 's/\\//g') # Remove backslashes if any (from JS escaping)
            write_to_param_file "$file_path" "$value"
        done
    fi
else
    log_info "No last VCore DVFS & GPU DVFS configuration file found at $LAST_APPLIED_VCORE_GPU_CONFIG_PATH. Applying default values."
    write_to_param_file "$HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH" "$VCORE_DVFS_BOOT_DEFAULT_VALUE"
    write_to_param_file "$GED_GPU_DVFS_ENABLE_PATH" "$GPU_DVFS_BOOT_DEFAULT_VALUE"
fi

log_info "VCore DVFS & GPU DVFS configuration application complete."
checkpoint "AFTER VCore DVFS & GPU DVFS section"


# --- New Section for DVFSRC Memory Tuning ---
checkpoint "BEFORE DVFSRC Memory Tuning section"
log_info "Starting application of last DVFSRC Memory Tuning configuration during boot..."

# Function khusus untuk DVFSRC dengan permission handling
apply_dvfsrc_setting() {
    local file_path="$1"
    local value="$2"
    local setting_name="$3"
    
    if [ -f "$file_path" ]; then
        # Set permission to writable
        chmod 644 "$file_path" 2>/dev/null || log_info "Note: Could not chmod 644 $file_path (may be normal)"
        
        # Apply the value
        echo -n "$value" > "$file_path"
        
        # Restore permission to read-only  
        chmod 444 "$file_path" 2>/dev/null || log_info "Note: Could not chmod 444 $file_path (may be normal)"
        
        log_info "Successfully applied DVFSRC $setting_name: $value"
    else
        log_error "DVFSRC file not found: $file_path"
    fi
}

if [ -f "$LAST_APPLIED_DVFSRC_CONFIG_PATH" ]; then
    last_dvfsrc_config=$(cat "$LAST_APPLIED_DVFSRC_CONFIG_PATH")
    if [ -z "$last_dvfsrc_config" ]; then
        log_info "Last DVFSRC configuration file ($LAST_APPLIED_DVFSRC_CONFIG_PATH) is empty. Applying default values."
        apply_dvfsrc_setting "$DVFSRC_GOVERNOR_PATH" "$DVFSRC_DEFAULT_GOVERNOR" "governor"
        apply_dvfsrc_setting "$DVFSRC_MIN_FREQ_PATH" "$DVFSRC_DEFAULT_MIN_FREQ" "min_freq" 
        apply_dvfsrc_setting "$DVFSRC_MAX_FREQ_PATH" "$DVFSRC_DEFAULT_MAX_FREQ" "max_freq"
    else
        log_info "Last DVFSRC configuration found."
        # Parse and apply each configuration line
        echo "$last_dvfsrc_config" | while IFS='=' read -r setting_key value; do
            case "$setting_key" in
                governor)
                    apply_dvfsrc_setting "$DVFSRC_GOVERNOR_PATH" "$value" "governor"
                    ;;
                min_freq)
                    apply_dvfsrc_setting "$DVFSRC_MIN_FREQ_PATH" "$value" "min_freq"
                    ;;
                max_freq)
                    apply_dvfsrc_setting "$DVFSRC_MAX_FREQ_PATH" "$value" "max_freq"
                    ;;
                *)
                    log_error "Unrecognized DVFSRC setting: $setting_key"
                    ;;
            esac
        done
    fi
else
    log_info "No last DVFSRC configuration file found at $LAST_APPLIED_DVFSRC_CONFIG_PATH. Applying default values."
    apply_dvfsrc_setting "$DVFSRC_GOVERNOR_PATH" "$DVFSRC_DEFAULT_GOVERNOR" "governor"
    apply_dvfsrc_setting "$DVFSRC_MIN_FREQ_PATH" "$DVFSRC_DEFAULT_MIN_FREQ" "min_freq"
    apply_dvfsrc_setting "$DVFSRC_MAX_FREQ_PATH" "$DVFSRC_DEFAULT_MAX_FREQ" "max_freq"
fi

log_info "DVFSRC Memory Tuning configuration application complete."
checkpoint "AFTER DVFSRC Memory Tuning section"

# Di AKHIR service.sh, tambahkan:
echo "$(date): 🚀 Starting SurfaceFlinger optimization..." >> /data/adb/modules/${MODULE_ID}/cache/startfs.log

checkpoint "BEFORE launching surfaceflinger_opt.sh (nohup background)"
# Jalankan script SurfaceFlinger di background
nohup sh /data/adb/modules/${MODULE_ID}/surfaceflinger_opt.sh > /dev/null 2>&1 &

checkpoint "BEFORE OC Engine section"


# --- New Section: OC Engine (overclock_mt6789.ko — CPU/GPU overclock kernel module) ---
# Murni tambahan berdiri sendiri: gak nyentuh/gak nimpa GPU proc-node settings di atas
# (fix_target_opp_index / fix_custom_freq_volt), keduanya independen satu sama lain.
log_info "Starting OC Engine (overclock_mt6789) init..."

OC_KO="/data/adb/modules/${MODULE_ID}/modules/overclock_mt6789.ko"
OC_NAME="overclock_mt6789"
OC_BASELINE_FILE="/data/adb/modules/${MODULE_ID}/cache/oc_baseline.json"
OC_CPU_LL_MAXF="/sys/devices/system/cpu/cpufreq/policy0/cpuinfo_max_freq"
OC_CPU_B_MAXF="/sys/devices/system/cpu/cpufreq/policy6/cpuinfo_max_freq"

# Capture stock CPU max freq SEKALI SAJA (hanya kalau file baseline belum ada), sebelum
# insmod. Ini acuan "stock" yang dipakai WebUI buat batas bawah slider — kalau setiap
# boot capture ulang, dan kebetulan boot itu OC masih nyangkut, angka stock-nya bisa
# ketiban nilai yang udah di-OC. Jadi capture pertama kali dikunci permanen.
if [ ! -f "$OC_BASELINE_FILE" ]; then
    oc_ll_khz=0
    oc_b_khz=0
    [ -r "$OC_CPU_LL_MAXF" ] && oc_ll_khz=$(cat "$OC_CPU_LL_MAXF")
    [ -r "$OC_CPU_B_MAXF" ] && oc_b_khz=$(cat "$OC_CPU_B_MAXF")
    [ -z "$oc_ll_khz" ] && oc_ll_khz=0
    [ -z "$oc_b_khz" ] && oc_b_khz=0
    cat > "$OC_BASELINE_FILE" <<EOF
{"cpu_ll_stock_khz": ${oc_ll_khz}, "cpu_b_stock_khz": ${oc_b_khz}}
EOF
    log_info "OC Engine: baseline stock CPU max freq captured (ll=${oc_ll_khz}KHz, b=${oc_b_khz}KHz)."
else
    log_info "OC Engine: baseline file sudah ada, skip re-capture."
fi

# Catat freq/volt stock GPU idx0 SEBELUM modul di-insmod (tabel OPP belum ke-patch jadi pasti stock).
# Dipakai WebUI buat bedain "cache driver masih stock" vs "frekuensi fixed yang ditimpa belakangan".
OC_GPU_OPP_TABLE="/proc/gpufreqv2/gpu_working_opp_table"
OC_GPU_STOCK_FILE="/data/adb/modules/${MODULE_ID}/cache/oc_gpu_stock.json"
if [ ! -d "/sys/module/${OC_NAME}" ] && [ -r "$OC_GPU_OPP_TABLE" ]; then
    oc_gpu_line=$(head -n 1 "$OC_GPU_OPP_TABLE")
    oc_gpu_f=$(echo "$oc_gpu_line" | sed -n 's/.*freq: *\([0-9]*\).*/\1/p')
    oc_gpu_v=$(echo "$oc_gpu_line" | sed -n 's/.*volt: *\([0-9]*\).*/\1/p')
    if [ -n "$oc_gpu_f" ] && [ -n "$oc_gpu_v" ]; then
        echo "{\"freq_khz\": ${oc_gpu_f}, \"volt_raw\": ${oc_gpu_v}}" > "$OC_GPU_STOCK_FILE"
        log_info "OC Engine: stock GPU idx0 tercatat (freq=${oc_gpu_f}KHz, volt=${oc_gpu_v})."
    fi
fi

if [ -d "/sys/module/${OC_NAME}" ]; then
    log_info "OC Engine: ${OC_NAME}.ko sudah loaded, skip insmod."
elif [ -f "$OC_KO" ]; then
    oc_insmod_out=$(insmod "$OC_KO" 2>&1)
    if [ -d "/sys/module/${OC_NAME}" ]; then
        log_info "OC Engine: ${OC_NAME}.ko berhasil di-load."
    else
        log_error "OC Engine: insmod ${OC_NAME}.ko gagal: ${oc_insmod_out} | kernel: $(uname -r) (vermagic .ko harus cocok, cek juga dmesg/avc SELinux)."
    fi
else
    log_error "OC Engine: file ${OC_KO} tidak ditemukan, skip."
fi

# SENGAJA: parameter cpu_*_target_khz / gpu_target_* TIDAK di-reapply otomatis di sini.
# Modul selalu mulai dari 0 (=stock) tiap boot sampai kamu apply manual lagi dari WebUI.
# Ini keputusan keamanan yang disengaja (OC+voltage custom, beda kelas resiko dibanding
# render backend/FPSGO di atas yang aman di-auto-reapply) — bukan bug.
log_info "OC Engine init complete (targets start at 0/stock every boot by design)."
checkpoint "AFTER OC Engine section"


checkpoint "=== SERVICE.SH END (main thread returning) ==="
# ZENKU R5.4.3: opt-in, isolated PQ Color reapply. Existing GPU/FPSGo logic intact.
if [ -f "/data/adb/modules/${MODULE_ID}/pq_autoboot.sh" ]; then
    /system/bin/sh "/data/adb/modules/${MODULE_ID}/pq_autoboot.sh" >/dev/null 2>&1 &
fi
exit 0
