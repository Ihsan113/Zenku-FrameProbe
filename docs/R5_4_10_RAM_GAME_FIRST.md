# ZENKU R5.4.11 — Moderate RAM policy

Target: Android 13 / MediaTek MT6789 (Helio G99).
Base: ZENKU R5.4.10.

## LMKD properties

```properties
ro.lmk.use_psi=true
ro.lmk.use_minfree_levels=false
ro.lmk.psi_partial_stall_ms=70
ro.lmk.psi_complete_stall_ms=700
ro.lmk.thrashing_limit=100
ro.lmk.thrashing_limit_decay=10
ro.lmk.swap_free_low_percentage=20
ro.lmk.kill_heaviest_task=true
ro.lmk.kill_timeout_ms=100
```

These are AOSP high-performance baseline starting values, not a universal
performance preset. Actual defaults may vary by device classification and
vendor configuration. They do not reserve RAM for the foreground game or
guarantee lower frame times.

## Scope

Only LMKD thresholds are moderated from R5.4.10. No ZRAM size, compression
algorithm, swap enablement, swappiness, VM sysctls, DVFSRC, CPU/GPU clocks,
thermal limits, cpusets, or OOM adjustment changes.

## Verification

```sh
su -c 'for p in ro.lmk.use_psi ro.lmk.use_minfree_levels ro.lmk.psi_partial_stall_ms ro.lmk.psi_complete_stall_ms ro.lmk.thrashing_limit ro.lmk.thrashing_limit_decay ro.lmk.swap_free_low_percentage ro.lmk.kill_heaviest_task ro.lmk.kill_timeout_ms; do echo "$p=$(getprop "$p")"; done'
```

Property readback confirms values are present; it does not alone prove the
running LMKD consumed each setting. Compare logs and frame pacing with the
previous build.

AOSP reference: https://source.android.com/docs/core/perf/lmkd
