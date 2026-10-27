# Sensor Mouse Lab: gravity-estimation correction candidate

These two files replace `src/imu.js` and `src/pipeline.js` of the fetched v7 project. They are a candidate for device testing, not a verified sensor accuracy fix.

- Orientation gravity correction is allowed only when `StationaryDetector.observe()` returns `matched` and gyro deviation is small. A near-9.81 m/s² magnitude is insufficient to prove stationary.
- Fixed reference gravity branch is exposed separately as `tracks.fixed`, `anchoredFixed`, `fixedGravity` and `fixedLinear`.
- Free integration retains residual drift for diagnosis; constrained channels retain the pre-existing ZUPT behavior.
- This code does not fix the fundamental unobservability of constant-velocity movement from an IMU alone.
- The existing front end does not yet render the new fixed branch; update UI wiring/CSV separately before deployment.
- This branch still depends on the browser's actual axis and gyro sign conventions; verify clockwise tilt tests against a physical device.
