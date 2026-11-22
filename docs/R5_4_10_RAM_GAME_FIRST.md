# ZENKU R5.4.10 — Game-first RAM policy

Target: Android 13 / MediaTek MT6789 (Helio G99).
Base: ZENKU R5.4.9.

## LMKD properties

```properties
ro.lmk.use_psi=true
ro.lmk.use_minfree_levels=false
ro.lmk.psi_partial_stall_ms=55
ro.lmk.psi_complete_stall_ms=700
ro.lmk.thrashing_limit=80
ro.lmk.thrashing_limit_decay=50
ro.lmk.swap_free_low_percentage=25
ro.lmk.kill_heaviest_task=true
ro.lmk.kill_timeout_ms=100
```

The partial PSI threshold (55 ms) and thrashing threshold (80) are more
sensitive than AOSP high-performance defaults (70 ms and 100 respectively).
The swap-free threshold (25%) is above the high-performance default (20%),
so LMKD can treat swap as starved earlier. These are aggressive tuning values,
not a guarantee of lower frame time. Revert toward AOSP defaults if useful apps
are killed too early or frame pacing becomes worse.

`kill_heaviest_task=true` selects the largest process only among tasks already
eligible for LMKD termination. Android process importance / OOM adjustment
still determines eligibility; this does not reserve physical RAM for the game
or guarantee that the game can never be killed.

## Scope

This change only adjusts documented `ro.lmk.*` properties in `system.prop`
and mirrors them through the existing early-boot `resetprop -n` routine in
`post-fs-data.sh`.

It does NOT change ZRAM size, compression algorithm, swap enablement,
swappiness, VM sysctls, DVFSRC, CPU/GPU clocks, thermal limits, cpusets,
or OOM adjustment scores.

## AOSP references

- https://source.android.com/docs/core/perf/lmkd
- https://android.googlesource.com/platform/system/memory/lmkd/+/refs/tags/android-cts-13.0_r15/

## Post-boot verification

```sh
su -c 'for p in ro.lmk.use_psi ro.lmk.use_minfree_levels ro.lmk.psi_partial_stall_ms ro.lmk.psi_complete_stall_ms ro.lmk.thrashing_limit ro.lmk.thrashing_limit_decay ro.lmk.swap_free_low_percentage ro.lmk.kill_heaviest_task ro.lmk.kill_timeout_ms; do echo "$p=$(getprop "$p")"; done'
```

Matching `getprop` values confirm the values are present, not by themselves
that the running LMKD consumed every value. Inspect the module boot log for
`OK:` / `GAGAL:` entries and compare game frame pacing before/after.
