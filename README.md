# Android Mouse PC — Sensor Mouse Lab

A static, browser-based prototype for exploring smartphone motion sensors as mouse input.

## What it does

- Reads motion/orientation sensors where supported by the device and browser.
- Simulates pointer movement *within the page*.
- Allows tuning sensitivity, threshold, smoothing and damping, with an on-page graph.
- Includes simulated controls for devices without motion sensor access.

**Not a Bluetooth mouse yet.** This website does not access the operating system mouse pointer, connect to a PC, or transmit sensor data to a server. Sensor access typically needs HTTPS and user permission; browser/device support varies.

## Free deployment with GitHub Pages

1. Commit `index.html`, `README.md`, and `LICENSE` at the repository root on the default branch.
2. GitHub repository **Settings → Pages → Build and deployment**.
3. Select **Deploy from a branch**, then choose the default branch and `/(root)`; save.
4. After Pages is deployed, visit `https://soone-y.github.io/Android-Mouse-PC-/` from your phone.
5. Tap the sensor start button and grant the browser's motion-sensor permission if prompted.

This is a static site with no dependencies, server, tracking, analytics, or secrets. GitHub Pages availability and usage limits are governed by GitHub policies, so avoid using the repository for confidential files. You can unpublish in Settings → Pages.

## License

[zlib License](LICENSE). Copyright (c) 2026 soone-y and contributors.
