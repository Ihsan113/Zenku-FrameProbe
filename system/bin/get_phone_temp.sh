#!/system/bin/sh

# Jalur ke sensor suhu HP bawaan (BATTERY).
# Berdasarkan temuan Anda: /sys/class/thermal/thermal_zone28: battery
PHONE_TEMP_PATH="/sys/class/thermal/thermal_zone28/temp"

# Fungsi untuk mendapatkan suhu dari path tertentu
get_temp() {
    local path="$1"
    local temp="Unknown"
    if [ -f "$path" ]; then
        temp_raw=$(cat "$path" 2>/dev/null)
        if [ -n "$temp_raw" ] && [ "$temp_raw" -ge 0 ]; then
            # Suhu biasanya dalam millidegree Celsius (misal, 45000 untuk 45.0 C), bagi 1000
            temp=$(echo "scale=1; $temp_raw / 1000" | bc 2>/dev/null)
            if [ -z "$temp" ]; then # Fallback jika bc gagal
                temp=$((temp_raw / 1000))
            fi
        else
            temp="Unknown"
        fi
    fi
    echo "$temp"
}

PHONE_TEMP=$(get_temp "$PHONE_TEMP_PATH")

echo "{\"phone_temp\": \"$PHONE_TEMP\"}"