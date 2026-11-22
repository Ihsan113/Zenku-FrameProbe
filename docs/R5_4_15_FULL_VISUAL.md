# ZENKU R5.4.15 — Full Visual controls restored

This release uses the R5.4.14 package baseline and restores the prior controls in the Visual page.

## Controls
- AF: Native, 2x, 4x, 8x, 16x.
- GL texture filtering: Trilinear, Linear MAG, Combined Split, Native.
- Global AOSP EGL MSAA 4x checkbox (retained ON by default).
- Experimental controls: Force RGBA8888, Native Mali EGL MSAA 4x, Highp FP32 request.
- Presets: AAA++, Performance, Balance.

## Evidence and limitations
AF and filter state changes/readback were confirmed on the dedicated native GPUD probe. Native Mali MSAA config selection was confirmed for offscreen PBUFFER/ES2. Global AOSP MSAA remains an available prior framework setting. Probe success does not prove uniform effect in every game/window EGL path or guarantee FPS gains.
RGBA EGL selection was observed, but one detailed config readback showed alpha=0; full 8:8:8:8 should remain experimental.
Highp request can be set/read back, but precision promotion in the rendered shader was not established.
Game-window and anti-cheat compatibility are not established.

## Runtime safeguards
The tool checks Android SDK 33, MT6789 and exact 64-bit GPUD/Mali SHA-256 fingerprints before Apply. The target must be an installed third-party package. The target process is force-stopped to refresh the next EGL/GL initialization. Profiles are session-only.
