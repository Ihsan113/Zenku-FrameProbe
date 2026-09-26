# Zenku FrameProbe

Initial Magisk probe for Android 13 arm64.

## Purpose

This v1 package is intentionally observability-only. It records the presence of `libgui.so`, the SurfaceFlinger mapping when available, and the verified target offsets.

It does not patch instructions, bypass fences, alter VSYNC, or change function return values.

## Target offsets

- `BufferQueueProducer::dequeueBuffer` — `0x8b12c`
- `BufferQueueProducer::queueBuffer` — `0x8cb5c`
- `FrameEventHistory::checkFencesForCompletion` — `0x90580`
- `ProducerFrameEventHistory::updateAcquireFence` — `0x9090c`
- `GLConsumer::doGLFenceWaitLocked` — `0xb6d94`

## Runtime log

`/data/local/tmp/zenku_frameprobe.log`

## Build

Use GitHub Actions -> **Build Zenku FrameProbe** -> Run workflow.

The ZIP artifact is named `Zenku-FrameProbe-v1.0.zip`.
