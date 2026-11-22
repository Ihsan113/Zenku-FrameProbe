# ZENKU R5.4 — STABLE LAST

## Tujuan
Pemulihan dari kemungkinan stuttering setelah penambahan tweak SurfaceFlinger R5.2/R5.3.
Berdasarkan paket R5.1 yang menjadi baseline sebelum eksperimen tersebut.
Tidak mengubah pengaturan visual, GPUD, GPU, FPSGo, baterai, renderer SkiaGL, dan profil VSync.

## Tiga perbaikan SurfaceFlinger

| Properti | Nilai R5.4 | Alasan |
|---|---:|---|
| debug.sf.disable_backpressure | 1 | Mengikuti default /vendor/build.prop MT6789, membatalkan override R5.2=0 |
| debug.sf.enable_planner_prediction | 0 | Membatalkan fitur eksperimen R5.3; sesuai default AOSP |
| debug.sf.send_early_power_session_hint | 0 | Membatalkan fitur eksperimen R5.3; sesuai default AOSP |

Tetap dipertahankan:
- debug.sf.enable_gl_backpressure=1
- vendor.debug.sf.latch_unsignaled=0, debug.sf.latch_unsignaled=0, debug.sf.auto_latch_unsignaled=true
- ro.surface_flinger.display_update_imminent_timeout_ms=60
- debug.sf.enable_adpf_cpu_hint=true
- Renderer SkiaGL dan profil phase offset 60/90 Hz R5

## Pemasangan
Pasang ZIP via KernelSU Next atau Magisk, lalu reboot. Jangan pasang berdampingan
dengan versi ZENKU sebelumnya; ID modul tetap sama (`mtk_idle_charging_magisk`).
Konfigurasi GPU/FPSGo dan profil Pacing pengguna dipertahankan oleh customize.sh.

## Verifikasi setelah reboot (Termux)

    su -c 'for p in debug.sf.disable_backpressure debug.sf.enable_gl_backpressure debug.sf.enable_planner_prediction debug.sf.send_early_power_session_hint vendor.debug.sf.latch_unsignaled debug.sf.latch_unsignaled debug.sf.auto_latch_unsignaled ro.surface_flinger.display_update_imminent_timeout_ms; do echo "$p=$(getprop "$p")"; done'

Target: 1,1,0,0,0,0,true,60 sesuai urutan.

## Batasan
Lulus verifikasi statis ZIP dan sintaks; belum diuji pada perangkat.
`getprop` hanya membaca properti; tidak membuktikan FPS, latensi, atau mode live SF.
Jika stutter masih terjadi, gunakan profil Pacing Stable untuk uji A/B, dengan reboot.
