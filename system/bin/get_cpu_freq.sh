#!/system/bin/sh

# Jalur frekuensi CPU untuk Mediatek G99
CPU_FREQ_PATH="/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"

# Fungsi untuk mendapatkan frekuensi dari path tertentu
get_freq() {
    local path="$1"
    local freq="Unknown"
    if [ -f "$path" ]; then
        freq_raw=$(cat "$path" 2>/dev/null)
        if [ -n "$freq_raw" ] && [ "$freq_raw" -ge 0 ]; then
            # Frekuensi CPU biasanya dalam KHz, jadi bagi 1000000 untuk GHz
            freq=$(echo "scale=2; $freq_raw / 1000000" | bc 2>/dev/null)
            if [ -z "$freq" ]; then # Fallback jika bc gagal (misal tidak ada)
                freq=$(($freq_raw / 1000000))
            fi
            freq="${freq} GHz"
        else
            freq="Unknown"
        fi
    fi
    echo "$freq"
}

CPU_FREQ=$(get_freq "$CPU_FREQ_PATH")

echo "{\"cpu_freq\": \"$CPU_FREQ\"}"