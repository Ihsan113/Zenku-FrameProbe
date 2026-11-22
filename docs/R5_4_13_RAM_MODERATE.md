# ZENKU R5.4.13 — Moderate RAM policy

This release is based on the latest main branch R5.4.12, not the older feature branch.

LMKD starting values:
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
performance preset. Device/vendor defaults can differ. The settings do not
reserve RAM for the foreground game and do not guarantee lower frame times.

No ZRAM size/algorithm, swap enablement, swappiness, VM sysctls, DVFSRC,
CPU/GPU clocks, thermal limits, cpusets, or OOM adjustment values are changed.

After reboot, read back properties with:
```sh
su -c 'for p in ro.lmk.use_psi ro.lmk.use_minfree_levels ro.lmk.psi_partial_stall_ms ro.lmk.psi_complete_stall_ms ro.lmk.thrashing_limit ro.lmk.thrashing_limit_decay ro.lmk.swap_free_low_percentage ro.lmk.kill_heaviest_task ro.lmk.kill_timeout_ms; do echo "$p=$(getprop "$p")"; done'
```

A property readback does not alone prove the running LMKD consumed the value.
AOSP reference: https://source.android.com/docs/core/perf/lmkd
