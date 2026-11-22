#!/system/bin/sh
LOG_FILE="/data/local/tmp/idle_charging_debug.log"
echo "$(date): get_idle_charging_status.sh started" >> "$LOG_FILE"

if [ -f /proc/mtk_battery_cmd/current_cmd ]; then
    echo "$(date): /proc/mtk_battery_cmd/current_cmd found. Reading status." >> "$LOG_FILE"
    STATUS=$(cat /proc/mtk_battery_cmd/current_cmd 2>&1) # Ambil juga stderr
    if [ $? -eq 0 ]; then # Cek status perintah cat
        echo "$(date): Status read: $STATUS" >> "$LOG_FILE"
        echo "$STATUS"
        exit 0
    else
        echo "$(date): ERROR: Failed to read from /proc/mtk_battery_cmd/current_cmd. Output: $STATUS" >> "$LOG_FILE"
        echo "ERROR: Failed to read status."
        exit 1
    fi
else
    echo "$(date): ERROR: /proc/mtk_battery_cmd/current_cmd not found" >> "$LOG_FILE"
    echo "ERROR: /proc/mtk_battery_cmd/current_cmd not found"
    exit 1
fi