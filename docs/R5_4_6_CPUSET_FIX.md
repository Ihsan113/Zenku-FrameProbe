# ZENKU R5.4.6 — CPUSET ROM POLICY FIX

Patch minimal dari ZENKU R5.4.5 (Dynamic App Picker + PQ WebRoot).

## Penyebab yang ditemukan
Pada `surfaceflinger_opt.sh` R5.4.5, saat SurfaceFlinger aktif, skrip menulis
`4-7` ke `/dev/cpuset/top-app/cpus`, lalu memindahkan PID SurfaceFlinger ke
`/dev/cpuset/top-app/tasks`. Tindakan pertama membatasi SELURUH tugas
`top-app`, termasuk thread game di kelompok itu, ke CPU4-7.

## Yang berubah
- Hapus penulisan `4-7` ke `/dev/cpuset/top-app/cpus`.
- Hapus pemindahan SurfaceFlinger ke cpuset `top-app` oleh ZENKU.
- Catat hasil cpuset top-app dan affinity SF apa adanya ke `cache/surfaceflinger.log`.
- Pembagian CPU `top-app` mengikuti kebijakan ROM/vendor. Patch ini TIDAK
  menjamin `0-7` jika init vendor menetapkan nilai lain.
- Prioritas SF (`renice`), seluruh tweak lain, PQ, WebRoot, GPU, FPSGo,
  zRAM, dan visual DIPERTAHANKAN tanpa perubahan.

## Verifikasi di HP (setelah flash + reboot)
Jalankan pada Termux:

```sh
su -c 'echo top-app=$(cat /dev/cpuset/top-app/cpus); echo effective=$(cat /dev/cpuset/top-app/effective_cpus); p=$(pidof surfaceflinger); [ -n "$p" ] && grep Cpus_allowed_list /proc/$p/status; grep "CPUSET FIX" /data/adb/modules/mtk_idle_charging_magisk/cache/surfaceflinger.log | tail -1'
```

Jika `top-app` masih `4-7`, berarti ada init/vendor/modul lain yang mengaturnya;
ini bukan bukti patch gagal. Cek dengan modul lain dan ROM jika perlu.
Uji MLBB pada adegan dan suhu serupa; tidak ada klaim FPS pasti naik.

Rollback: flash ulang ZENKU R5.4.5 yang sudah kamu simpan.
