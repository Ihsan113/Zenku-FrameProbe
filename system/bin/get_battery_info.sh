#!/system/bin/sh

BATTERY_PATH="/sys/class/power_supply/battery"

# Fungsi pembantu untuk membaca file sysfs dan mengembalikan JSON
read_sysfs_file_json() {
    local file_path="$1"
    local key="$2"
    local value=$(cat "$file_path" 2>/dev/null)
    # Menghapus whitespace atau karakter non-ASCII yang mungkin mengganggu JSON
    value=$(echo "$value" | tr -d '\n\r' | sed 's/"/\\"/g')
    if [ -z "$value" ]; then
        echo "\"$key\": \"Unknown\""
    else
        echo "\"$key\": \"$value\""
    fi
}

echo "{"

# Status Idle Charging (dari skrip Anda sebelumnya)
IDLE_STATUS=$(cat /proc/mtk_battery_cmd/current_cmd 2>/dev/null)
if [ "$IDLE_STATUS" = "0 1" ]; then
    echo "\"idle_charging_status\": \"enabled\","
elif [ "$IDLE_STATUS" = "0 0" ]; then
    echo "\"idle_charging_status\": \"disabled\","
else
    echo "\"idle_charging_status\": \"unknown\","
fi

# Informasi Baterai
read_sysfs_file_json "$BATTERY_PATH/health" "health"
echo "," # <--- PASTI ADA KOMANYA
read_sysfs_file_json "$BATTERY_PATH/capacity" "capacity"
echo "," # <--- PASTI ADA KOMANYA
read_sysfs_file_json "$BATTERY_PATH/charge_full" "charge_full"
echo "," # <--- PASTI ADA KOMANYA
read_sysfs_file_json "$BATTERY_PATH/cycle_count" "cycle_count"
echo "," # <--- PASTI ADA KOMANYA
read_sysfs_file_json "$BATTERY_PATH/voltage_now" "voltage_now"
echo "," # <--- PASTI ADA KOMANYA
read_sysfs_file_json "$BATTERY_PATH/current_now" "current_now"
# Tambahkan charge_full_design untuk perhitungan kesehatan baterai kedua
echo "," # <--- PASTI ADA KOMANYA UNTUK YANG SEBELUM BARIS TERAKHIR INI
read_sysfs_file_json "$BATTERY_PATH/charge_full_design" "charge_full_design"

echo "}" # Tutup JSON