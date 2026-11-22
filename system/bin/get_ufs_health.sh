#!/system/bin/sh

# Mencari path UFS health descriptor secara dinamis
UFS_HEALTH_FILE=$(find /sys/devices/platform/soc/ -name "life_time_estimation_a" 2>/dev/null | head -n 1)

# Cek apakah file ditemukan
if [ -f "$UFS_HEALTH_FILE" ]; then
    HEALTH_CODE=$(cat "$UFS_HEALTH_FILE")
    echo "{\"ufs_health_code\": \"$HEALTH_CODE\"}"
else
    # Jika path tidak ditemukan, laporkan sebagai "Unknown"
    echo "{\"ufs_health_code\": \"Unknown\", \"error_message\": \"UFS health path not found: /sys/devices/platform/soc/*ufshci/health_descriptor/life_time_estimation_a\"}" >&2
    exit 1
fi