# Zenku FrameProbe v2.0

Native C++ Zygisk architecture adapted from the DanzKu-Visual-Shader project structure.

Current native stage is intentionally observational: it records the libgui executable mapping and the verified target offsets. It does not patch fence waits, VSYNC, buffering, or return values.

Targets: BufferQueueProducer::dequeueBuffer 0x8b12c; queueBuffer 0x8cb5c; FrameEventHistory::checkFencesForCompletion 0x90580; ProducerFrameEventHistory::updateAcquireFence 0x9090c; GLConsumer::doGLFenceWaitLocked 0xb6d94.
