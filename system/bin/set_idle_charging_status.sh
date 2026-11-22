#!/system/bin/sh
STATUS_CMD="$1"
if [ -z "$STATUS_CMD" ]; then
    echo "ERROR: Missing argument (e.g., '0 1' or '0 0')"
    exit 1
fi
if [ -f /proc/mtk_battery_cmd/current_cmd ]; then
    echo "$STATUS_CMD" > /proc/mtk_battery_cmd/current_cmd
    if [ $? -eq 0 ]; then # Cek status perintah echo
        echo "SUCCESS: Set charging status to $STATUS_CMD"
        exit 0
    else
        echo "ERROR: Failed to write to /proc/mtk_battery_cmd/current_cmd (permission/device issue)"
        exit 1
    fi
else
    echo "ERROR: /proc/mtk_battery_cmd/current_cmd not found"
    exit 1
fi