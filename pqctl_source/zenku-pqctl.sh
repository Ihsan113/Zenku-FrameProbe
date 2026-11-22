#!/data/data/com.termux/files/usr/bin/sh
# Portable Termux launcher. DEX runs in Android app_process with root via su.
set -eu
if [ "$#" -eq 0 ]; then set -- help; fi
JAR=/data/local/tmp/zenku-pqctl.jar
if [ ! -f "$JAR" ]; then
  echo 'Belum dipasang. Ekstrak ZIP, lalu jalankan bash install-termux.sh di Termux.' >&2
  exit 1
fi
# Diagnose packaging before starting the Android runtime.
if ! command -v unzip >/dev/null 2>&1; then
  echo 'ERROR: unzip diperlukan untuk validasi JAR. pkg install unzip' >&2
  exit 1
fi
for descriptor in 'LZENKUPqCtl;' 'LZENKUPqCtl$Reply;'; do
  if ! unzip -p "$JAR" classes.dex | grep -aFq "$descriptor"; then
    echo "ERROR: JAR lama/tidak lengkap: $descriptor tidak ditemukan. Jalankan installer v0.2." >&2
    exit 1
  fi
done
# No shell metacharacters are accepted. Args are only fixed words, digits and flags.
ARGS=''
for item do
  case "$item" in
    ''|*[!a-zA-Z0-9_.-]*) echo "Parameter tidak aman: $item" >&2; exit 2 ;;
  esac
  ARGS="$ARGS $item"
done
# Save the current property state before ANY command with --apply.
case " $ARGS " in
  *' --apply '*)
    BACKUP="${HOME:-/data/data/com.termux/files/home}/storage/downloads/zenku_pq_before_$(date +%Y%m%d_%H%M%S).txt"
    {
      echo '# ZENKU PQ pre-write property snapshot'
      date
      for p in persist.vendor.sys.pq.contrastidx persist.vendor.sys.pq.gsatidx \
        persist.vendor.sys.pq.brightidx persist.vendor.sys.pq.gamma.index \
        persist.vendor.sys.globalpq.enable persist.vendor.sys.globalpq.strength \
        persist.vendor.sys.pq.picmode persist.sys.sf.color_saturation; do
        printf '%s=[%s]\n' "$p" "$(getprop "$p")"
      done
      printf 'command=%s\n' "$ARGS"
    } > "$BACKUP" 2>/dev/null || echo 'WARNING: gagal membuat property snapshot' >&2
    echo "Property snapshot: $BACKUP"
    ;;
esac
# app_process binder HIDL runs in its own process. A nonzero return prevents success claims.
su -c "CLASSPATH=$JAR /system/bin/app_process /system/bin ZENKUPqCtl$ARGS"
