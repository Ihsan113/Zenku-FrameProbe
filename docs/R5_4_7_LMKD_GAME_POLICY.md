# ZENKU R5.4.7 — LMKD & GameManager policy additions

Base: R5.4.6 CPUSET ROM POLICY FIX for Android 13 / MT6789.

## Added properties

```properties
ro.lmk.kill_heaviest_task=true
ro.lmk.kill_timeout_ms=100
ro.lmk.thrashing_limit_decay=50
debug.graphics.game_default_frame_rate.disabled=true
```

The three `ro.lmk.*` properties are documented by the Android 13 AOSP LMKD implementation:

- `kill_heaviest_task=true`: choose the heaviest eligible process rather than the first eligible process.
- `kill_timeout_ms=100`: after a kill, wait 100 ms before performing another kill.
- `thrashing_limit_decay=50`: use 50% of the original thrashing threshold when the threshold is decayed after the system fails to recover.

The existing `ro.lmk.use_minfree_levels=false` remains unchanged, so the module keeps its PSI-based LMKD mode. No zRAM/swap size, CPU/GPU clock, thermal limit or cpuset policy is changed by this update.

`debug.graphics.game_default_frame_rate.disabled=true` is set as requested. It only has an effect on framework builds that implement the corresponding GameManager default-frame-rate override. It does not remove a frame-rate cap built into a game and does not force 60/90 FPS. On a framework without that implementation, it is an unused property.

## Application

The values are declared in `system.prop` and also applied/read back by `post-fs-data.sh` using `resetprop -n`, consistent with the module's existing early-property policy. The boot log records success/failure for each runtime application.

## Verification after reboot

```sh
su -c 'for p in ro.lmk.use_minfree_levels ro.lmk.kill_heaviest_task ro.lmk.kill_timeout_ms ro.lmk.thrashing_limit_decay debug.graphics.game_default_frame_rate.disabled; do printf "%s=" "$p"; getprop "$p"; done'
```

A matching `getprop` value confirms the property value is present, not that a ROM service consumes it. Check `cache/boot.log` in the module directory for `OK:` or `GAGAL:` entries.
