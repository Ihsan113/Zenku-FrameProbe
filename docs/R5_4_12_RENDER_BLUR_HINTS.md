# ZENKU R5.4.12 — Skia RenderThread and SurfaceFlinger blur hint

Base: R5.4.11 (versionCode 20), Android 13 / MT6789.

## Added / enforced properties

    renderthread.skia.reduceopstasksplitting=true
    ro.sf.blurs_are_expensive=1

Both properties are declared in system.prop and applied/read back early in post-fs-data.sh.

### Skia RenderThread

renderthread.skia.reduceopstasksplitting=true is an established Android device build property. Google device build configurations include it to enable Skia reduceOpsTaskSplitting. It concerns HWUI/Skia RenderThread task splitting; it does not precompile OpenGL/Vulkan shaders for games and does not directly control a game's asset streaming.

Reference:
https://android.googlesource.com/device/google/coral/+/b2fecc83e246f7c8bca2e62592406ea773388b69/device.mk

### SurfaceFlinger expensive-blur hint

Android 13 SurfaceFlinger reads ro.sf.blurs_are_expensive at construction and passes the resulting flag as CompositionRefreshArgs::blursAreExpensive. The AOSP CompositionRefreshArgs comment specifies that when true, GPU clocks are increased when rendering blurs.

References:
- https://android.googlesource.com/platform/frameworks/native/+/refs/heads/android13-release/services/surfaceflinger/SurfaceFlinger.cpp
- https://android.googlesource.com/platform/frameworks/native/+/578a060d32/services/surfaceflinger/CompositionEngine/include/compositionengine/CompositionRefreshArgs.h

This is a hint for SurfaceFlinger blur composition, not a global GPU overclock. It only matters when the build supports background blur and an actual system blur layer is rendered. It does not enable blur capability by itself, and it does not fix game shader compilation, game asset streaming, or ordinary in-game UI that is rendered entirely inside the game's own surface.

## Verification after reboot

    su -c 'for p in renderthread.skia.reduceopstasksplitting ro.sf.blurs_are_expensive ro.surface_flinger.supports_background_blur; do printf "%s=" "$p"; getprop "$p"; done'
    su -c 'grep -E "reduceopstasksplitting|blurs_are_expensive" /data/adb/modules/mtk_idle_charging_magisk/cache/boot.log'

A matching getprop confirms the property value is present. It does not prove the display HAL/Power HAL actually changed GPU frequency. Compare blur-on and blur-off cases at similar temperature and load before claiming a performance gain.

No forced GPU clock, thermal bypass, HWC composition override, or game process hook is added by this revision.
