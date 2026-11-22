# ZENKU R5.4.15 FINAL

Final Visual release built on the R5.4.14 package baseline.

Restored controls:
- AF Native / 2x / 4x / 8x / 16x
- Trilinear / Combined Split / Linear MAG / Native filter selection
- Global AOSP EGL MSAA 4x checkbox (default ON)
- Force RGBA8888, Native Mali MSAA 4x and Highp FP32 experimental switches
- AAA++, Performance and Balance presets

The profile tool is session-only and checks Android 13 SDK, MT6789 platform, and exact 64-bit GPUD/Mali library fingerprints. It reads back the applied properties and checks native EGL MSAA separately using both sample.buffers and samples.

Probe readback proves these properties/hooks can be set in the probe. It is not a claim that every game/window EGL path consumes them identically or that FPS improves. RGBA alpha layout, shader precision promotion, game-window MSAA and anti-cheat compatibility remain application/device test items.
