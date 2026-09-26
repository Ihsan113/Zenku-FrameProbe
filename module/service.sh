#!/system/bin/sh
MODDIR=${0%/*}
LOG=/data/local/tmp/zenku_frameprobe_service.log
printf '%s\\n' '[Zenku] FrameProbe native C++ module service started' >> "$LOG"
chmod 0644 "$LOG"
