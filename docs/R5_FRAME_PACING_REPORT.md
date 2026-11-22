# ZENKU R5 — Frame Pacing & Analytical Simulation

**Device:** Poco M5 / MT6789 / Android 13 / Mali-G57 MC2 / 60-90Hz. **ROM:** Project Elixir GSI.
**Source module:** R4.1_WebUI_Fix.zip. **Reference:** mtk_idle_charging_magisk_1_8_0_oc_AOSP_Stable.zip.

## Source of formulas

Android AOSP `services/surfaceflinger/Scheduler/VsyncConfiguration.cpp` PhaseOffsets::constructOffsets, getDefaultOffsets/getHighFpsOffsets.
Uses the high-fps branch when VSync period is < 15,000,000 ns; otherwise default.
`sfWorkDuration = period - sfPhaseOffset` for SF offsets below threshold; `appWorkDuration = period + sfPhaseOffset - appPhaseOffset` with another period only if less than period.
**AOSP threshold is NOT a timeout**: crossing it triggers an offset subtraction by a VSync period. All selected SF offsets are <10,000,000ns (the configured threshold) and <both 60/90Hz periods.

## Model input (not real FPS measurements)

At 60Hz period=16,666,667ns and 90Hz period=11,111,111ns. Profiles are chosen as tradeoffs: higher SF offset wakes compositor later (lower latency proxy) but shrinks SF work-duration margin. They do not alter the game engine rendering pipeline or GPU compute budget.
Stable prioritizes more SF work headroom; Balanced AAA is compromise; Latency moves SF later with less headroom.

## Calculated mode outputs (nanoseconds)

| Profile | Hz | Phase | App offset | SF offset | App work | SF work |
|---|---:|---|---:|---:|---:|---:|
| stable | 60 | late | 2,100,000 | 3,300,000 | 17,866,667 | 13,366,667 |
| stable | 60 | early | 1,500,000 | 2,600,000 | 17,766,667 | 14,066,667 |
| stable | 60 | earlyGL | 1,000,000 | 1,900,000 | 17,566,667 | 14,766,667 |
| stable | 90 | late | 1,700,000 | 2,600,000 | 12,011,111 | 8,511,111 |
| stable | 90 | early | 1,200,000 | 2,100,000 | 12,011,111 | 9,011,111 |
| stable | 90 | earlyGL | 850,000 | 1,600,000 | 11,861,111 | 9,511,111 |
| balanced | 60 | late | 4,200,000 | 6,200,000 | 18,666,667 | 10,466,667 |
| balanced | 60 | early | 3,100,000 | 4,700,000 | 18,266,667 | 11,966,667 |
| balanced | 60 | earlyGL | 2,250,000 | 3,550,000 | 17,966,667 | 13,116,667 |
| balanced | 90 | late | 3,200,000 | 4,300,000 | 12,211,111 | 6,811,111 |
| balanced | 90 | early | 2,500,000 | 3,450,000 | 12,061,111 | 7,661,111 |
| balanced | 90 | earlyGL | 1,800,000 | 2,650,000 | 11,961,111 | 8,461,111 |
| latency | 60 | late | 5,800,000 | 7,300,000 | 18,166,667 | 9,366,667 |
| latency | 60 | early | 4,550,000 | 6,150,000 | 18,266,667 | 10,516,667 |
| latency | 60 | earlyGL | 3,450,000 | 4,900,000 | 18,116,667 | 11,766,667 |
| latency | 90 | late | 4,700,000 | 5,900,000 | 12,311,111 | 5,211,111 |
| latency | 90 | early | 3,400,000 | 4,500,000 | 12,211,111 | 6,611,111 |
| latency | 90 | earlyGL | 2,600,000 | 3,550,000 | 12,061,111 | 7,561,111 |

## Synthetic SF workload stress model (NOT measured hardware)

Table evaluates if SF work duration leaves headroom for hypothetical compositor execution times. Real scheduling may miss deadlines for different reasons.

| Profile | Hz | Late SF budget | 2ms task | 4ms task | 6ms task | 8ms task |
|---|---:|---:|---|---|---|---|
| stable | 60 | 13.367 ms | +11.367 ms ✓ | +9.367 ms ✓ | +7.367 ms ✓ | +5.367 ms ✓ |
| stable | 90 | 8.511 ms | +6.511 ms ✓ | +4.511 ms ✓ | +2.511 ms ✓ | +0.511 ms ✓ |
| balanced | 60 | 10.467 ms | +8.467 ms ✓ | +6.467 ms ✓ | +4.467 ms ✓ | +2.467 ms ✓ |
| balanced | 90 | 6.811 ms | +4.811 ms ✓ | +2.811 ms ✓ | +0.811 ms ✓ | -1.189 ms ✗ |
| latency | 60 | 9.367 ms | +7.367 ms ✓ | +5.367 ms ✓ | +3.367 ms ✓ | +1.367 ms ✓ |
| latency | 90 | 5.211 ms | +3.211 ms ✓ | +1.211 ms ✓ | -0.789 ms ✗ | -2.789 ms ✗ |

**Disclaimer:** This is an algebraic scheduler model and synthetic workload feasibility table, not an emulator of MLBB/PUBG gameplay, measured p95 frametimes, or a claim that any profile is universally optimal. Heavy GPU/thermal limits can dominate outcomes.

## 90Hz ROM reference from user dumpsys (while work-duration mode active)
Late App=20,500,000ns and Late SF=10,500,000ns; early 16,500,000/21,000,000; early GL 21,000,000/13,500,000. R5 balanced projects late app 12,211,111ns, late SF 6,811,111ns at 90Hz. Smaller scheduler budget can produce lower latency *or* extra jank depending actual GPU/CPU load.

## Boot safety / workflow
1. Installs under existing Magisk/KSU module ID. Default profile is `balanced`.
2. `post-fs-data.sh` only applies manual mode on MT6789 + Android SDK33. Boot-only `resetprop -n` sets mode 0 FIRST and verifies via getprop. If mode write fails, all phase props skipped.
3. Then applies both 60Hz and 90Hz profile props, threshold 10ms. AOSP WorkDuration validation does not execute in mode 0. Existing ROM `debug.sf.*.duration` props remain untouched.
4. Other R4.1 features retained, no new GPU clocks or forced refresh mode.
5. WebUI Pacing tab can save profile `rom`, `stable`, `balanced`, `latency` for next reboot. CLI: `su -c /system/bin/sh /data/adb/modules/mtk_idle_charging_magisk/phase_tuner.sh set rom` then reboot.
6. Do not attempt runtime restart of SurfaceFlinger. For unrecoverable boot trouble, disable module from recovery / kernel root manager.

## Verification commands
`su -c "getprop debug.sf.use_phase_offsets_as_durations; dumpsys SurfaceFlinger | grep -iE 'app phase:|app duration:|early app phase:|early app duration:|GL early app phase:'"`

## Limitations
- Boot success is not equivalent to stutter-free games. Only on-device Perfetto/frame timing can evaluate benefit.
- 60/90Hz branches follow *display refresh interval*, not the game FPS setting.
- Changing profiles after boot does not affect current SurfaceFlinger; must reboot.
- GPU/Visual WebUI session settings still reset at reboot as in original R4.1.
- No Vulkan changes, no forced GPU clock/thermal bypass, no global anti-cheat hooking.
- Boot selector and phase-offset branch validated with synthetic mocked getprop/resetprop for 4 profiles and failure case; still requires on-device verification.
