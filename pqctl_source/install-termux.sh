#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

BASE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ ! -f "$BASE/src/ZENKUPqCtl.java" ]; then
  echo 'ERROR: taruh struktur ZIP utuh; src/ZENKUPqCtl.java tidak ditemukan.' >&2
  exit 1
fi
if ! command -v pkg >/dev/null 2>&1; then
  echo 'Installer ini harus dijalankan di Termux asli (BUKAN Ubuntu/proot atau su).' >&2
  exit 1
fi
if [ "$(id -u)" = 0 ]; then
  echo 'Jalankan installer sebagai user Termux biasa; sudo/su hanya diperlukan untuk pemanggilan HAL.' >&2
  exit 1
fi
if ! command -v javac >/dev/null 2>&1; then pkg install -y openjdk-17; fi
if ! command -v zip >/dev/null 2>&1; then pkg install -y zip; fi
if ! command -v d8 >/dev/null 2>&1 && ! command -v dx >/dev/null 2>&1; then
  pkg install -y d8 || pkg install -y dx || { echo 'ERROR: instal d8 atau dx di Termux.' >&2; exit 1; }
fi
BUILD="$(mktemp -d "${TMPDIR:-$PREFIX/tmp}/zenku-pqctl.XXXXXX")"
trap 'rm -rf "$BUILD"' EXIT
mkdir -p "$BUILD/classes" "$BUILD/dex"

javac --release 8 -Xlint:-options -d "$BUILD/classes" "$BASE/src/ZENKUPqCtl.java"
# IMPORTANT: javac creates TWO classes (outer + nested Reply).
# v0.1 accidentally fed only the outer .class to d8, resulting in
# NoClassDefFoundError: ZENKUPqCtl$Reply on Android.
[ -s "$BUILD/classes/ZENKUPqCtl.class" ] || { echo 'ERROR: kelas utama hilang.' >&2; exit 1; }
[ -s "$BUILD/classes/ZENKUPqCtl\$Reply.class" ] || { echo 'ERROR: kelas nested Reply hilang.' >&2; exit 1; }
if command -v d8 >/dev/null 2>&1; then
  d8 --min-api 26 --output "$BUILD/dex" "$BUILD/classes"/*.class
else
  dx --dex --output="$BUILD/dex/classes.dex" "$BUILD/classes"/*.class
fi
[ -s "$BUILD/dex/classes.dex" ] || { echo 'ERROR: DEX kosong.' >&2; exit 1; }
# Verify class descriptors in generated DEX, not merely in javac output.
for descriptor in 'LZENKUPqCtl;' 'LZENKUPqCtl$Reply;'; do
  if ! grep -aFq "$descriptor" "$BUILD/dex/classes.dex"; then
    echo "ERROR: DEX tidak memuat $descriptor - pemasangan dibatalkan." >&2
    exit 1
  fi
done
(
  cd "$BUILD/dex"
  zip -q -j "$BUILD/zenku-pqctl.jar" classes.dex
)

# Store DEX where root app_process can access it without needing Termux's private folder.
if ! command -v su >/dev/null 2>&1; then
  echo 'ERROR: su tidak tersedia. Perlu root/KernelSU/Magisk untuk akses HAL.' >&2
  exit 1
fi
su -c 'mkdir -p /data/local/tmp && chmod 755 /data/local/tmp' || exit 1
# Atomic replacement: avoid half-written JAR during launcher execution.
su -c "cp '$BUILD/zenku-pqctl.jar' /data/local/tmp/zenku-pqctl.jar.new && chmod 644 /data/local/tmp/zenku-pqctl.jar.new && mv -f /data/local/tmp/zenku-pqctl.jar.new /data/local/tmp/zenku-pqctl.jar" || {
    echo 'ERROR: gagal memasang DEX ke /data/local/tmp via root.' >&2; exit 1;
  }
cp "$BASE/zenku-pqctl.sh" "$PREFIX/bin/zenku-pqctl"
chmod 755 "$PREFIX/bin/zenku-pqctl"

echo
echo 'INSTALLED: /data/local/tmp/zenku-pqctl.jar'
echo 'CLI: zenku-pqctl'
echo 'FIX v0.2: kelas nested Reply disertakan + DEX divalidasi.'
echo 'Tes: zenku-pqctl status'
echo 'Catatan: status HAL belum diuji di perangkat; jika SELinux menolak, jangan ubah policy.'
