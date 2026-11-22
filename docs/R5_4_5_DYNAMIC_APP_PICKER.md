# ZENKU R5.4.5 — Dynamic App & Game Picker

Upgrades the R5.4.4 bundled-PQ module without changing GPU/OC/FPSGo, zRAM, PQ presets, HIDL JAR, SurfaceFlinger, thermal, or battery charging implementations.

## Three integrated pages

1. **Battery > Prioritas Proses Aplikasi**: installed third-party apps, real app labels, icons where supported. Running processes appear first. Inactive apps are visible but disabled, because `renice` needs a living PID. A PID/process-name check happens immediately before applying the priority to avoid PID reuse.
2. **GPU > Per-App Rendering (ANGLE)**: searchable app chooser with large app name, icon, package name; active overrides have legible name + package/driver + icon.
3. **Visual > Profil Tekstur**: replaces hard-coded games with installed third-party apps, searchable picker, same display. Backend `visual_tuner.sh` now validates a proper package syntax and checks the target against Android `pm list packages -3` before force-stopping/overriding any target. Protected system/manager packages excluded.

## Catalog source and fallback

Primary: KernelSU/KernelSU-Next package bridge (`ksu.pm.listPackages`, `ksu.listUserPackages`, or legacy `ksu.listPackages`), retrieving `appLabel` from `getPackagesInfo`.
Secondary: `pm list packages -3` for live installed package names. Labels from games.json are used only where available; otherwise package names are shown unmodified.
Final fallback: `webroot/games.json` if both installed-app sources fail. This fallback is explicitly marked as unverified, to avoid representing uninstalled games as installed. Battery can still select a JSON-listed running app, but GPU/Visual require verified installation for applying overrides.

Icons: `ksu://icon/{package}` supported by KernelSU managers, with `ksu.getPackagesIcons` PNG base64 fallback on KernelSU-Next. When neither icon API is supported, show a neutral initial placeholder rather than downloading fake icon images. No remote network dependency.

## Mobile UX

- Search by app label/package; large tap targets, scrollable bottom sheet, focus handling, Escape/backdrop dismissal.
- Selection preview with real icon/name/package where supported.
- Source count and live status; no arbitrary fixed game whitelist on the Visual backend.
- Native selection values preserved under the hood, so existing apply functions remain compatible.

## Unchanged

- PQ Control: all limits, profiles and bundled `bin/zenku-pqctl.jar` preserved.
- Gamma and GlobalPQ remain untouched.
- Boot scripts, original CPU/GPU/OC, audio, battery and memory features unchanged.

## QA

- `node --check` on modified JS, `sh -n` for Visual backend, `bash -n` for installer.
- Pure JS tests for source priority, accurate labels, JSON fallback and package validation.
- `unzip -t` archive test, file-preservation comparison against R5.4.4.
- The actual KernelSU/KernelSU-Next WebView and icon bridge require validation on the user's device; this is not claimed as tested on-device.
