#!/system/bin/sh

# ===========================================
# 🔋 Zenku's Mini Battery Calibrator v1.3 🔋
# ===========================================

BATTERY_PATH="/sys/class/power_supply/battery"

# Pastikan skrip dijalankan sebagai ROOT
if [ "$(id -u)" != "0" ]; then
  echo "🚫 Kesalahan: Skrip ini harus dijalankan sebagai ROOT!"
  exit 1
fi

# Dapatkan status baterai
voltage_uv=$(cat $BATTERY_PATH/voltage_now 2>/dev/null)
capacity_percent=$(cat $BATTERY_PATH/capacity 2>/dev/null)
status_charging=$(cat $BATTERY_PATH/status 2>/dev/null)

voltage_mv=$((voltage_uv / 1000))

echo ""
echo "==========================================="
echo " 🔋 Zenku's Mini Battery Calibrator v1.3 🔋 "
echo "==========================================="
echo ""
echo "📈 Tegangan Baterai Saat Ini : ${voltage_mv} mV"
echo "🔢 Persentase Baterai Saat Ini : ${capacity_percent}%"
echo "🔌 Status Charger : ${status_charging}"
echo ""

# Default = gagal
all_ok=true

# Cek kapasitas
if [ "$capacity_percent" -ge 95 ]; then
  echo "✅ Persentase ≥95% ✔ (${capacity_percent}%)"
else
  echo "❌ Persentase <95% (${capacity_percent}%)"
  all_ok=false
fi

# Cek tegangan
if [ "$voltage_mv" -ge 4150 ]; then
  echo "✅ Tegangan ≥4150mV ✔ (${voltage_mv}mV)"
else
  echo "❌ Tegangan <4150mV (${voltage_mv}mV)"
  all_ok=false
fi

# Cek status charging
if [ "$status_charging" = "Charging" ]; then
  echo "✅ HP sedang di-charge"
else
  echo "❌ HP tidak sedang di-charge"
  all_ok=false
fi

echo ""

# Evaluasi hasil
if [ "$all_ok" = true ]; then
  echo "------------------------------------------------"
  echo "✅ Semua syarat kalibrasi terpenuhi. Melanjutkan..."
  echo "------------------------------------------------"
else
  echo "------------------------------------------------"
  echo "⚠️ PERINGATAN: Syarat kalibrasi belum terpenuhi!"
  echo "🔋 Silakan isi daya hingga semua syarat ✅ hijau."
  echo "------------------------------------------------"
  exit 0
fi

# Remount /data rw
echo "🛠️ Memastikan partisi /data dapat ditulis..."
mount -o remount,rw /data 2>/dev/null || echo "ℹ️ Remount /data gagal atau sudah rw."
echo ""

# Hapus file statistik baterai
BATTERY_STATS_FILE="/data/system/batterystats.bin"
echo "🧹 Menghapus file statistik baterai..."

if [ -f "${BATTERY_STATS_FILE}" ]; then
  rm -f "${BATTERY_STATS_FILE}" && echo "✅ ${BATTERY_STATS_FILE} berhasil dihapus." || echo "🚫 Gagal menghapus ${BATTERY_STATS_FILE}."
else
  echo "ℹ️ ${BATTERY_STATS_FILE} tidak ditemukan."
fi

# Sinkronisasi perubahan ke disk
echo "🔄 Menyinkronkan perubahan ke disk..."
sync
echo "✅ Sinkronisasi selesai."
echo ""

echo "------------------------------------------------"
echo "📢 Kalibrasi awal selesai. Perangkat akan REBOOT (via WebUI)!"
echo "------------------------------------------------"
echo ""
echo "📌 Tips:"
echo "   1. Gunakan baterai sampai 3–5%."
echo "   2. Cas penuh tanpa interupsi (lebih baik biarkan >30 menit setelah 100%)."
echo ""
echo "==========================================="
echo "       🎯 Proses Kalibrasi Selesai!"
echo "==========================================="
echo ""

# Kirim sinyal ke WebUI agar bisa trigger reboot
echo "REBOOT_TRIGGER"
exit 0
