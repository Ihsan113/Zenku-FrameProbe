# ZENKU R5.4.4 — MT6789 PQ Color WebRoot + Bundled Helper

**Base:** ZENKU R5.4.2 Comfort Color 1.10 + LMKD PSI + headset fix. `service.sh`, GPU, FPSGo, OC Engine, idle charging, pacing, and all existing tabs remain in the archive. No zRAM changes.

## What is implemented

- **KernelSU Next WebUI** > **Visual** > **PQ Color Control** (new `pq.html`). Root bridge uses `window.ksu.exec` to call the module's `pq_tuner.sh`. No HTTP server or remote connection.
- **Native MediaTek HIDL**: uses the proven ZENKUPqCtl v0.2 DEX/JAR via `app_process`, HIDL `vendor.mediatek.hardware.pq@2.0::IPictureQuality/default`. It writes `setPQIndex()` on **scenario 0** with index **9 contrast / 1 saturation / 10 brightness**, and reads back the Vivid profile. Device reported scenario 2 uses shared values; no separate 1/2 write in this version.
- **Hard bound:** all three PQ parameters limited to **4–9**, validated both in WebUI and the root shell. >9 is refused. This does not alter the separate Termux-installed v0.2 CLI's own experimental bounds; use the module's WebUI and `pq_tuner.sh` for the guarded workflow.
- **Android Boosted**: `settings put system display_color_mode 1` (or Automatic mode 3). Then `service call SurfaceFlinger 1022 f <factor>`; factor is 1.00–1.30 in steps of 0.05. These are separate from PQ index limits. This binder transaction may be overwritten by Android later; output `Parcel(NULL)` is not display measurement. `getprop persist.sys.sf.color_saturation` may not reflect manual binder setting.
- **Templates:** Natural `4/4/4, Automatic, 1.00`; Balanced `5/5/4, Boosted, 1.10`; Vivid `7/7/5, Boosted, 1.15`; Custom editable; baseline reset `4/4/4, Boosted, 1.10`. These are experimental suggestions, not calibrated profiles. Natural is not factory-calibrated/true Standard MediaTek PQ.
- **Reset** to previously observed user baseline 4/4/4 with Android Boosted+SF1.10 and autoboot off. **Not factory reset:** setting PQ indices to 4 does not remove persisting vendor properties which originally had empty values.
- **Opt-in autoboot**: default off; only when user checks autoboot and taps Apply will `service.sh` launch a short background handler waiting for `sys.boot_completed=1`, then applying saved settings once. No endless loops, no restart of SurfaceFlinger.
- **Snapshots** before every manual write under `cache/pq_before_*.txt`. On failed HAL writes/readback, the script attempts rollback of the previous three readings. It cannot promise exact restoration of Android/SF state if framework later overwrites it.
- **Gamma, GlobalPQ, HueAdj/SatAdj left completely unchanged.** No new sepolicy rules.

## Self-contained installation (R5.4.4)

The ZIP **includes** `bin/zenku-pqctl.jar` (the tested ZENKUPqCtl v0.2 DEX supplied by the user; SHA-256 recorded below). The installer checks it exists, sets `0644`, and **does not** copy/overwrite it from `/data/local/tmp/`. WebRoot's shell controller always prefers the bundled file. No Termux, D8, binutils, JDK, or separate HIDL helper is needed for use.

If the bundled file is manually deleted or damaged after flashing, `pq_tuner.sh` can optionally fall back to the old `/data/local/tmp/zenku-pqctl.jar` for recovery; this path is **not required** for clean installs. Reinstall the ZIP to recover the bundled helper.

**Bundled JAR SHA-256:** `06dbdcc84282543fbf87c97a81b496e861b4b97021dd8db43276eac1d0632095`.

Install via KernelSU/Magisk **Modules > Install from storage**, choose R5.4.4 ZIP, reboot, open **ZENKU WebUI > Visual > PQ Color Control**, Refresh, choose a profile, Apply. APK or browser remote access is not required.

## CLI for troubleshooting

From **Termux with root** (e.g. `su -c '...'`):

```sh
su -c 'sh /data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh status'
su -c 'sh /data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh restore'
su -c 'sh /data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh apply balanced 5 5 4 boosted 1.10 0'
su -c 'sh /data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh apply vivid 7 7 5 boosted 1.15 1'
```

Last `0/1` toggles apply-on-boot. Values out of 4–9 for PQ are rejected. No `--apply` flag is used for this new module wrapper; apply commands always write, status only reads.

## Caveats

- Host static/simulated tests can validate scripts/UI but cannot prove final behavior on the real Poco M5 after flashing. User already confirmed v0.2 HIDL works and changes display; WebRoot wiring still requires a quick device validation.
- `settings get ...` may return an Android Binder error in some root contexts; it is displayed as unknown if it fails. HAL readback is checked independently.
- A screen capture may not reflect the panel's final color hardware processing. Use direct display observation or a second camera for A/B comparisons.
- This replaces the same module ID and should update rather than create a second separate ZENKU module. Existing GPU and FPSGo options are preserved.
