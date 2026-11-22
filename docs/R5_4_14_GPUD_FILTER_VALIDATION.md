# ZENKU R5.4.14 — GPUD texture control validation

## Scope

This release exposes only controls whose GL state could be changed and read back on the local native EGL/GLES probe, process name gpulab, with the analyzed Android 13 / MT6789 / Mali-G57 MC2 driver hashes.

**Important:** these tests were run in the dedicated probe process, not inside Mobile Legends. They prove that the GPUD hooks accepted the requested values on that probe. They do not prove that a game loads the same hook, consumes the selected property, improves image quality, or maintains its FPS.

## Controls exposed in Visual

| Control | Allowed values | Probe evidence |
|---|---|---|
| Anisotropic filtering | Native / 4× / 16× | Texture and sampler AF readback matched; AF 4× and 16× returned with no GL error |
| Trilinear MIN filtering | Both texture and sampler MIN | GL_TEXTURE_MIN_FILTER = GL_LINEAR_MIPMAP_LINEAR; texture and sampler readback matched |
| Linear MAG filtering | Both texture and sampler MAG | GL_TEXTURE_MAG_FILTER = GL_LINEAR; texture and sampler readback matched |
| Combined Split filtering | Texture MIN trilinear + sampler MAG linear | Separate hook readback showed texture MIN 0x2703 and sampler MAG 0x2601 |

### Why Split is a distinct mode

The current GPUD interface exposes one pname/value pair for the texture integer hook and one for the sampler integer hook. It cannot configure both MIN and MAG independently on both paths at the same time. Split therefore routes Trilinear MIN through the texture hook and Linear MAG through the sampler hook. It must not be described as both filters forced on the same sampler object.

## Excluded controls

- Native EGL MSAA 4×: config selection was confirmed only for the offscreen PBUFFER / ES2 probe. Game window EGL selection and performance impact were not validated.
- Global AOSP EGL MSAA: not shown to improve the target game; disabled by default to avoid imposing unknown GPU cost globally.
- RGBA8888: the detailed EGL config readback did not establish a full 8:8:8:8 channel layout (alpha readback was 0).
- Highp FP32: precision promotion was not observed in the render probe.
- Scissor and viewport: property-driven state changes were observed, but these alter the draw rectangle/coordinates and can crop or distort the game image. They are not visual-quality enhancements.
- Shader source rewrite and FBC disable: no conclusive benefit/readback proof.

## Runtime safeguards

- Exact Android SDK, MT6789 platform, GPUD library SHA-256 and Mali library SHA-256 must match before Apply.
- Target package must be an installed third-party app.
- Apply validates arguments, disables legacy experimental requests, writes the selected values, and enables GPUD last.
- The target is force-stopped so the next GL process can initialize with the new properties.
- Profiles are session-only and are not written to a persistent cache.
- Off clears AF/filter properties, disables GPUD, clears prior RGBA/EGL config overrides, turns off Highp and global EGL MSAA requests, then force-stops the previously selected target.
- The default boot profile remains AF 4× + Trilinear; Highp and global EGL MSAA requests are OFF.

## Visual interpretation

AF may improve texture detail at oblique angles; Trilinear may smooth mip transitions; Linear MAG may change magnification sampling. Those are expected GL sampling effects, not measured results from MLBB on this device. FPS, frame-time, thermals, image differences, and anti-cheat compatibility still require in-game A/B testing.
