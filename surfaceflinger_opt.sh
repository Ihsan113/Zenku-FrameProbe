#!/system/bin/sh

MODULE_ID="mtk_idle_charging_magisk"
LOG_FILE="/data/adb/modules/${MODULE_ID}/cache/surfaceflinger.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "================================================" >> "$LOG_FILE"
echo "$(date): 🚀 Starting SurfaceFlinger Optimization..." >> "$LOG_FILE"
echo "================================================" >> "$LOG_FILE"

# --- Shared checkpoint log (dipakai bareng post-fs-data.sh & service.sh) ---
CHECKPOINT_LOG="/data/adb/modules/${MODULE_ID}/cache/checkpoint.log"
checkpoint() {
    up=$(cut -d' ' -f1 /proc/uptime 2>/dev/null)
    echo "[$(date '+%H:%M:%S') | uptime=${up}s] [SF-OPT] $1" >> "$CHECKPOINT_LOG"
    sync
}
checkpoint "=== SURFACEFLINGER_OPT.SH START ==="

# ⏳ Tunggu GPU tuning selesai
echo "$(date): ⏳ Waiting 30 seconds for GPU tuning to complete..." >> "$LOG_FILE"
sleep 30
checkpoint "30s GPU-tuning wait done, entering SF stability-wait loop"

# 🔁 Tunggu SurfaceFlinger benar-benar aktif DAN stabil
echo "$(date): ⏳ Menunggu SurfaceFlinger aktif dan stabil..." >> "$LOG_FILE"

counter=0
max_wait=80
stability_count=0
required_stability=3  # Butuh 3x check berturut-turut

while [ $stability_count -lt $required_stability ]; do
    counter=$((counter + 1))
    current_status=$(getprop init.svc.surfaceflinger)
    echo "$(date): ⏳ Status: $current_status - percobaan $counter/$max_wait, stability: $stability_count/$required_stability" >> "$LOG_FILE"
    
    if [ "$current_status" = "running" ]; then
        stability_count=$((stability_count + 1))
        echo "$(date): ✅ Stability check $stability_count/$required_stability" >> "$LOG_FILE"
    else
        stability_count=0  # Reset jika status berubah
        echo "$(date): 🔄 Status berubah, reset stability counter" >> "$LOG_FILE"
    fi
    
    if [ $counter -gt $max_wait ]; then
        echo "$(date): ❌ TIMEOUT: SurfaceFlinger tidak stabil setelah $max_wait percobaan" >> "$LOG_FILE"
        break
    fi
    sleep 1
done

if [ $stability_count -ge $required_stability ]; then
    echo "$(date): ✅ BERHASIL: SurfaceFlinger stabil dengan status: running" >> "$LOG_FILE"
    checkpoint "SF stability wait: STABLE after $counter tries"
else
    echo "$(date): ⚠️ PERINGATAN: SurfaceFlinger mungkin belum stabil" >> "$LOG_FILE"
    checkpoint "SF stability wait: TIMEOUT after $counter tries (status=$current_status)"
fi

# 🕐 Extra delay untuk memastikan SurfaceFlinger fully initialized
echo "$(date): ⏳ Extra delay 5 detik untuk SF initialization..." >> "$LOG_FILE"
sleep 5

# 🔍 Check service availability - FIXED
echo "$(date): 🔍 Checking required services..." >> "$LOG_FILE"

for service in "color_display" "SurfaceFlinger" "display"; do
    if service check "$service" 2>/dev/null | grep -q "found"; then
        echo "$(date): ✅ Service $service: AVAILABLE" >> "$LOG_FILE"
    else
        echo "$(date): ⚠️ Service $service: NOT AVAILABLE" >> "$LOG_FILE"
    fi
done

# 🎯 SF priority only. Preserve ROM/vendor cpuset and process placement.
# Never force /dev/cpuset/top-app/cpus=4-7: that restricts ALL top-app threads,
# not just SurfaceFlinger, and removes CPU0-3 from the game's effective mask.
checkpoint "BEFORE SF priority (vendor cpuset preserved)"
echo "$(date): 🎯 Mencari PID SurfaceFlinger..." >> "$LOG_FILE"

# Cari PID dengan multiple methods
SF_PID=$(pidof surfaceflinger)
if [ -z "$SF_PID" ]; then
    SF_PID=$(ps -A | grep surfaceflinger | head -n1 | awk '{print $2}')
    echo "$(date): 🔍 Mencoba method alternatif..." >> "$LOG_FILE"
fi

if [ ! -z "$SF_PID" ]; then
    echo "$(date): 🎯 PID SurfaceFlinger ditemukan: $SF_PID" >> "$LOG_FILE"
    
    # Log current priority dan affinity
    echo "$(date): 📊 Status awal SurfaceFlinger:" >> "$LOG_FILE"
    ps -o pid,ni,pri,psr,comm,etime -p $SF_PID >> "$LOG_FILE" 2>/dev/null || echo "$(date): ❌ Gagal cek status awal" >> "$LOG_FILE"
    
    # 1. Preserve cpuset ROM/vendor. Jangan pernah set top-app/cpus atau
    # memindahkan SF ke /dev/cpuset/top-app/tasks: keduanya mengubah kebijakan
    # scheduler aplikasi dan SurfaceFlinger secara global.
    echo "$(date): ✅ CPUSET FIX: skip 4-7 top-app lock & SF task migration (ROM/vendor policy)" >> "$LOG_FILE"
    if [ -r /dev/cpuset/top-app/cpus ]; then
        echo "$(date): 📊 top-app/cpus (ROM/vendor): $(cat /dev/cpuset/top-app/cpus)" >> "$LOG_FILE"
    fi
    if [ -r /proc/"$SF_PID"/status ]; then
        echo "$(date): 📊 SF allowed cpus (ROM/vendor): $(grep '^Cpus_allowed_list:' /proc/"$SF_PID"/status 2>/dev/null)" >> "$LOG_FILE"
    fi

    # 2. Set priority tinggi (tidak diubah pada patch cpuset ini)
    echo "$(date): 🚀 Setting priority ke -20..." >> "$LOG_FILE"
    if renice -n -20 -p $SF_PID 2>> "$LOG_FILE"; then
        echo "$(date): ✅ BERHASIL set priority SF ke -20" >> "$LOG_FILE"
        
        # Verifikasi perubahan priority
        NEW_NICE=$(ps -o ni -p $SF_PID 2>/dev/null | tail -n1 | tr -d ' ')
        echo "$(date): 📊 Nice value setelah perubahan: $NEW_NICE" >> "$LOG_FILE"
    else
        ERROR=$(renice -n -20 -p $SF_PID 2>&1)
        echo "$(date): ❌ GAGAL set priority SF: $ERROR" >> "$LOG_FILE"
        
        # Coba dengan su jika gagal
        echo "$(date): 🔄 Mencoba dengan su..." >> "$LOG_FILE"
        if su -c "renice -n -20 -p $SF_PID" 2>> "$LOG_FILE"; then
            echo "$(date): ✅ BERHASIL set priority via su" >> "$LOG_FILE"
        else
            ERROR_SU=$(su -c "renice -n -20 -p $SF_PID" 2>&1)
            echo "$(date): ❌ GAGAL set priority via su: $ERROR_SU" >> "$LOG_FILE"
        fi
    fi
    
    # Log status akhir
    echo "$(date): 📋 Status akhir SurfaceFlinger:" >> "$LOG_FILE"
    ps -o pid,ni,pri,psr,comm,etime -p $SF_PID >> "$LOG_FILE" 2>/dev/null || echo "$(date): ❌ Gagal cek status akhir" >> "$LOG_FILE"
    
else
    echo "$(date): ❌ GAGAL: Tidak dapat menemukan PID SurfaceFlinger" >> "$LOG_FILE"
    echo "$(date): 🔍 Process list terkait:" >> "$LOG_FILE"
    ps -A | grep -E "surface|flinger" >> "$LOG_FILE" 2>/dev/null
fi

checkpoint "AFTER SF priority block (cpuset preserved)"

# 🎮 Boost GPU settings
echo "$(date): 🎮 Boost GPU settings..." >> "$LOG_FILE"

# Boost GPU Enable
if [ -f "/sys/module/ged/parameters/boost_gpu_enable" ]; then
    if echo 1 > /sys/module/ged/parameters/boost_gpu_enable 2>> "$LOG_FILE"; then
        echo "$(date): ✅ boost_gpu_enable BERHASIL" >> "$LOG_FILE"
    else
        ERROR_GPU=$(echo 1 > /sys/module/ged/parameters/boost_gpu_enable 2>&1)
        echo "$(date): ❌ boost_gpu_enable GAGAL: $ERROR_GPU" >> "$LOG_FILE"
    fi
else
    echo "$(date): ⚠️ File boost_gpu_enable tidak ditemukan" >> "$LOG_FILE"
fi

# GED Smart Boost
if [ -f "/sys/module/ged/parameters/ged_smart_boost" ]; then
    if echo 1 > /sys/module/ged/parameters/ged_smart_boost 2>> "$LOG_FILE"; then
        echo "$(date): ✅ ged_smart_boost BERHASIL" >> "$LOG_FILE"
    else
        ERROR_GED=$(echo 1 > /sys/module/ged/parameters/ged_smart_boost 2>&1)
        echo "$(date): ❌ ged_smart_boost GAGAL: $ERROR_GED" >> "$LOG_FILE"
    fi
else
    echo "$(date): ⚠️ File ged_smart_boost tidak ditemukan" >> "$LOG_FILE"
fi

# 🖥️ Setup HDR Display (dengan stability check)
echo "$(date): 🖥️ Setup HDR Display... (dengan stability check)" >> "$LOG_FILE"

hdr_setup() {
    local attempts=0
    local max_attempts=10
    local success=0
    
    # Tunggu service color_display tersedia
    echo "$(date): ⏳ Menunggu service color_display tersedia..." >> "$LOG_FILE"
    service_wait=0
    while [ $service_wait -lt 15 ]; do
        if service check color_display 2>/dev/null | grep -q "found"; then
            echo "$(date): ✅ Service color_display tersedia" >> "$LOG_FILE"
            break
        fi
        service_wait=$((service_wait + 1))
        echo "$(date): ⏳ Menunggu service color_display... ($service_wait/15)" >> "$LOG_FILE"
        sleep 1
    done
    
    while [ $attempts -lt $max_attempts ]; do
        attempts=$((attempts + 1))
        echo "$(date): 🔄 Percobaan HDR $attempts/$max_attempts..." >> "$LOG_FILE"
        
        # Check if service exists
        if ! service check color_display 2>/dev/null | grep -q "found"; then
            echo "$(date): ❌ Service color_display tidak tersedia" >> "$LOG_FILE"
            sleep 2
            continue
        fi
        
        # Eksekusi service calls
        echo "$(date): 📞 Executing service call color_display 1 i32 1..." >> "$LOG_FILE"
        result1=$(service call color_display 1 i32 1 2>&1)
        exit1=$?
        echo "$(date): 📋 System feedback 1: $result1 (exit: $exit1)" >> "$LOG_FILE"
        
        echo "$(date): 📞 Executing service call color_display 4 i32 1..." >> "$LOG_FILE"
        result2=$(service call color_display 4 i32 1 2>&1)
        exit2=$?
        echo "$(date): 📋 System feedback 2: $result2 (exit: $exit2)" >> "$LOG_FILE"
        
        echo "$(date): 📞 Executing service call color_display 11 i32 1..." >> "$LOG_FILE"
        result3=$(service call color_display 11 i32 1 2>&1)
        exit3=$?
        echo "$(date): 📋 System feedback 3: $result3 (exit: $exit3)" >> "$LOG_FILE"
        
        # Cek hasil yang lebih akurat
        all_success=true
        
        # Check if calls actually succeeded (look for Parcel with 00000001)
        if ! echo "$result1" | grep -q "Parcel.*00000001"; then
            all_success=false
            echo "$(date): ⚠️ Call 1 mungkin gagal" >> "$LOG_FILE"
        fi
        
        if [ $exit1 -ne 0 ] || [ $exit2 -ne 0 ] || [ $exit3 -ne 0 ]; then
            all_success=false
        fi
        
        if [ "$all_success" = true ]; then
            echo "$(date): ✅ HDR Display BERHASIL diaktifkan" >> "$LOG_FILE"
            echo "$(date): 📊 Detail results:" >> "$LOG_FILE"
            echo "$(date):   - Call 1: $result1" >> "$LOG_FILE"
            echo "$(date):   - Call 2: $result2" >> "$LOG_FILE"
            echo "$(date):   - Call 3: $result3" >> "$LOG_FILE"
            success=1
            break
        else
            echo "$(date): ⏳ HDR gagal (percobaan $attempts/$max_attempts)" >> "$LOG_FILE"
            echo "$(date): 🔍 Detail error:" >> "$LOG_FILE"
            echo "$(date):   - Call 1: exit=$exit1, result=$result1" >> "$LOG_FILE"
            echo "$(date):   - Call 2: exit=$exit2, result=$result2" >> "$LOG_FILE"
            echo "$(date):   - Call 3: exit=$exit3, result=$result3" >> "$LOG_FILE"
            sleep 3
        fi
    done
    
    if [ $success -eq 0 ]; then
        echo "$(date): ❌ HDR GAGAL setelah $max_attempts percobaan" >> "$LOG_FILE"
        return 1
    fi
    return 0
}

# Tunggu lebih lama sebelum setup HDR
echo "$(date): ⏳ Menunggu 8 detik sebelum setup HDR..." >> "$LOG_FILE"
sleep 8
checkpoint "BEFORE hdr_setup()"
hdr_setup
checkpoint "AFTER hdr_setup() (exit=$?)"

# 🧬 BOOST THREAD CLASS & CPUSET
echo "$(date): 🧬 Boost thread class dan cpuset..." >> "$LOG_FILE"

write_sys() {
    local value="$1"
    local path="$2"
    local name="$3"
    
    echo "$(date): 📝 Writing $name: $value -> $path" >> "$LOG_FILE"
    
    if [ ! -f "$path" ]; then
        echo "$(date): ⚠️ File tidak ditemukan: $path" >> "$LOG_FILE"
        return 1
    fi
    
    if echo "$value" > "$path" 2>> "$LOG_FILE"; then
        echo "$(date): ✅ $name BERHASIL" >> "$LOG_FILE"
        
        # Verifikasi
        verified_value=$(cat "$path" 2>/dev/null)
        if [ "$verified_value" = "$value" ]; then
            echo "$(date): ✅ Verified $name: $verified_value" >> "$LOG_FILE"
        else
            echo "$(date): ⚠️ Verification mismatch: expected $value, got $verified_value" >> "$LOG_FILE"
        fi
        return 0
    else
        error_msg=$(echo "$value" > "$path" 2>&1)
        echo "$(date): ❌ $name GAGAL: $error_msg" >> "$LOG_FILE"
        return 1
    fi
}

checkpoint "BEFORE cpuset write_sys block"
# Set cpuset values
write_sys "0-7" "/dev/cpuset/foreground/cpus" "foreground_cpus"
write_sys "0-2" "/dev/cpuset/background/cpus" "background_cpus"
write_sys "0-5" "/dev/cpuset/system-background/cpus" "system_background_cpus"
# top-app cpus tidak diubah oleh ZENKU: pertahankan hasil init/vendor ROM; jangan kunci ke 4-7 atau paksa 0-7.
write_sys "0" "/dev/cpuset/restricted/cpus" "restricted_cpus"

# Enhanced verification - FIXED: hapus semua 'local'
echo "$(date): 🔍 ENHANCED VERIFICATION:" >> "$LOG_FILE"

# Check SurfaceFlinger process
if [ ! -z "$SF_PID" ]; then
    echo "$(date): 📊 SurfaceFlinger Process Status:" >> "$LOG_FILE"
    ps -o pid,ni,pri,psr,comm,etime -p $SF_PID >> "$LOG_FILE" 2>/dev/null
    
    # Check how long it's been running
    uptime=$(ps -o etime -p $SF_PID 2>/dev/null | tail -n1)
    echo "$(date): ⏱️ SurfaceFlinger uptime: $uptime" >> "$LOG_FILE"
fi

# Check HDR status via settings
echo "$(date): 🖥️ Display Settings Status:" >> "$LOG_FILE"
settings list system | grep -i color >> "$LOG_FILE" 2>/dev/null

echo "================================================" >> "$LOG_FILE"
echo "$(date): 🎉 SEMUA OPTIMISASI SURFACEFLINGER SELESAI!" >> "$LOG_FILE"
echo "================================================" >> "$LOG_FILE"

checkpoint "=== SURFACEFLINGER_OPT.SH END ==="
exit 0