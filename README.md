# Sensor Mouse Lab — browser IMU v2 update

Replace the repository root `index.html` with this version. Preserve the existing `LICENSE`, `README.md`, and `android-reference/`.

This standalone, static HTML port provides:

- IMU-only Madgwick orientation estimate and gravity compensation (if the browser provides acceleration including gravity and angular velocity).
- Browser-provided gravity-corrected acceleration as a fallback when fusion data is missing.
- Direct and experimental integrated acceleration-to-pointer mapping.
- Tunable gain, dead zone, low-pass smoothing, damping, stationary threshold, stationary hold duration, axis inversion, and Madgwick beta.
- Self-test, simulated input, sensor graph, local-only settings, and pointer-in-page demo.

It cannot control the OS pointer and contains no Bluetooth HID. Browser sensor axes and timing differ from Android native SensorEvent, so it is a design-aligned port, **not bit-identical**. The derived acceleration signal is not physical position. Validate on a real phone with HTTPS.

Testing performed: `node --check` on extracted scripts and Node smoke tests for zero-gradient Madgwick updates, static gravity subtraction, and positive-X pointer response. Full browser/real-device testing has not been performed.

zlib License, 2026 soone-y and contributors.
