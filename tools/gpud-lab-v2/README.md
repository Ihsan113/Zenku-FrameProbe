# ZENKU GPUD Batch Lab V2

Standalone Termux diagnostics package. This directory is excluded from the flashable Magisk ZIP.

Download `ZENKU_GPUD_BATCH_LAB_V2.zip`, extract it in Termux, then run:

```bash
chmod +x gpud_batch_v2.sh
./gpud_batch_v2.sh
```

The tool snapshots and restores touched properties, requires the expected MT6789 / Android 13 GPUD and Mali fingerprints before feature mutation, and runs isolated tests for AF/trilinear, RGBA/EGL config, MSAA, plus separate vendor and generic Scissor/Viewport candidate namespaces. FBC, Shader Source, and Highp are not marked successful without adequate evidence.
