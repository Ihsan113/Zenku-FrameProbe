#!/system/bin/sh

MODDIR="${0%/*}"
LOG="/data/local/tmp/zenku_frameprobe.log"

mkdir -p /data/local/tmp
chmod 700 /data/local/tmp
rm -f "$LOG"

echo "[Zenku] FrameProbe v1 started: $(date)" >> "$LOG"
echo "[Zenku] This v1 performs runtime mapping/address observability only." >> "$LOG"
echo "[Zenku] No fence/VSYNC return values are modified." >> "$LOG"

LIB="/system/lib64/libgui.so"

if [ -r "$LIB" ]; then
  echo "[Zenku] libgui.so present: $LIB" >> "$LOG"

  # Library load-bias/address reference points for the verified libgui build.
  BASE="0x0"
  if command -v grep >/dev/null 2>&1 && command -v awk >/dev/null 2>&1; then
    # Find the executable mapping from SurfaceFlinger and report it for manual correlation.
    PID="$(pidof surfaceflinger 2>/dev/null | awk '{print $1}')"
    if [ -n "$PID" ] && [ -r "/proc/$PID/maps" ]; then
      grep ' /system/lib64/libgui.so$' "/proc/$PID/maps" | head -n 2 >> "$LOG"
    fi
  fi
else
  echo "[Zenku] ERROR: $LIB not readable" >> "$LOG"
fi

echo "[Zenku] Target offsets:" >> "$LOG"
echo "  BufferQueueProducer::dequeueBuffer            0x8b12c" >> "$LOG"
echo "  BufferQueueProducer::queueBuffer              0x8cb5c" >> "$LOG"
echo "  FrameEventHistory::checkFencesForCompletion   0x90580" >> "$LOG"
echo "  ProducerFrameEventHistory::updateAcquireFence 0x9090c" >> "$LOG"
echo "  GLConsumer::doGLFenceWaitLocked               0xb6d94" >> "$LOG"
