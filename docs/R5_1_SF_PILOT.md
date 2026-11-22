# ZENKU R5.1 — PHH GSI SurfaceFlinger Pilot

Based on ZENKU R5 AAA FramePacing 60/90 Hz. **Only the boot-time SF latch policy and timeout were changed.** All earlier visual, GPUD, kernel, FPSGo and manual VSync timing remains unchanged.

## Why
PHH GSI `/system/etc/init/vndk.rc` contains the trigger:

```
on property:vendor.debug.sf.latch_unsignaled=1
    setprop debug.sf.latch_unsignaled 1
```

The user's actual runtime values were both 1 even though ZENKU's post-fs-data set `debug.sf.latch_unsignaled=0`. The pilot first sets `vendor.debug.sf.latch_unsignaled=0` with `resetprop -n` **only if it is 1**, then sets `debug.sf.latch_unsignaled=0` and `debug.sf.auto_latch_unsignaled=true`. This requests Android 13 **AutoSingleLayer**, not Always, on the next SurfaceFlinger initialization. Actual effective behavior still requires post-boot verification and cannot be guaranteed if the vendor reasserts the trigger later.

## Update imminent timeout
`ro.surface_flinger.display_update_imminent_timeout_ms=60`. AOSP reference default: **80 ms**. This is **experimental**, and advances when a new power hint may be sent **after an idle gap**. Continuous in-game rendering is unlikely to benefit directly. It is **not** a guaranteed FPS or latency improvement. Possible trade-offs include higher boost frequency, power consumption or thermal variation.

## Verification (Termux)

```
su -c 'for p in vendor.debug.sf.latch_unsignaled debug.sf.latch_unsignaled debug.sf.auto_latch_unsignaled ro.surface_flinger.display_update_imminent_timeout_ms; do echo "$p=$(getprop "$p")"; done'
su -c 'grep -E "vendor.debug.sf.latch_unsignaled|debug.sf.latch_unsignaled|display_update_imminent_timeout" /data/adb/modules/mtk_idle_charging_magisk/cache/boot.log | tail -15'
```

Expected property requests after reboot:

```
vendor.debug.sf.latch_unsignaled=0
debug.sf.latch_unsignaled=0
debug.sf.auto_latch_unsignaled=true
ro.surface_flinger.display_update_imminent_timeout_ms=60
```

A getprop match verifies writing/readback only, not the effective mode in a running SurfaceFlinger process. Avoid restarting SurfaceFlinger manually during gameplay.

## Rollback
If stability, display, game frame pacing or battery worsens, **reinstall the original ZENKU R5 ZIP** and reboot. Alternatively disable the module using the root manager if boot is affected. Keep the original ZIP available before testing.

## Safety & scope
No edits to system partitions, ROM `vndk.rc`, GPU clocks, thermal, SkiaGL, native visuals, phase offsets or other module controls. Uses existing root module boot lifecycle. Device target remains the user's Android 13/MT6789 ROM; this is not a universal recommended setting.
