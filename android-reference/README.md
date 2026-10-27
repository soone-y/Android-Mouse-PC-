# IMU processing v2 — Android reference

Source-derived refactor of `ImuSensorManager.kt`, `MadgwickAHRS.kt` and `MainViewModel.kt` supplied in conversation. These files are **a core algorithm reference, not a complete installable Android app**.

- `MadgwickAHRS.kt`: corrected zero-gradient normalization; finite inputs; bounded dt; yaw is not magnetically corrected.
- `ImuFusionEngine.kt`: gyroscope-timestamp-driven updates, accelerometer freshness check (50 ms), gravity vector removal. Feed **raw calibrated accelerometer including gravity**, not `TYPE_LINEAR_ACCELERATION` and not a zero-initialized corrected field.
- `MotionProcessor.kt`: independent mapping from gravity-corrected acceleration to relative pointer delta; adjustable direct/integrated mode, smoothing, dead zone, damping, stationary threshold. The integrated mode is experimental and does not recover trustworthy physical position.

## Example integration with Android SensorEventListener

```kotlin
private val fusion = ImuFusionEngine()
private val pointer = MotionProcessor()

// inside onSensorChanged(event):
when (event.sensor.type) {
    Sensor.TYPE_ACCELEROMETER -> fusion.onAccelerometer(
        event.timestamp, event.values[0], event.values[1], event.values[2]
    )
    Sensor.TYPE_GYROSCOPE -> fusion.onGyroscope(
        event.timestamp, event.values[0], event.values[1], event.values[2]
    )?.let { linear ->
        val delta = pointer.update(event.timestamp, linear[0], linear[1])
        // Render the delta locally, or encode as Bluetooth HID mouse reports later.
    }
}
```

Use Android's existing `SensorManager` and lifecycle handling from your app. Do not integrate these classes into `MainViewModel` without adjusting the separate sensor streams. The original `ImuSensorManager.kt` and view model remain unchanged.

**Calibration:** Gyro bias can be estimated from stationary samples. Single-orientation acceleration averaging cannot identify 3-axis hardware bias; do not treat it as a full accelerometer calibration. The processor may be used directly with `TYPE_LINEAR_ACCELERATION` in a simpler pipeline when Madgwick is disabled.

### Run pure Kotlin smoke test

```sh
kotlinc src/main/kotlin/com/example/movingsensorapp/sensor/*.kt src/test/kotlin/com/example/movingsensorapp/sensor/SmokeTest.kt -include-runtime -d /tmp/imu-test.jar
java -jar /tmp/imu-test.jar
```

No network, telemetry, location, Bluetooth privileges, or server is used by these classes. Distributed under repository's zlib License; derived improvements are marked as revised.
