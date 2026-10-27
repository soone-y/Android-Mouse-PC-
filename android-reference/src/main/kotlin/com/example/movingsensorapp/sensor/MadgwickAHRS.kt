package com.example.movingsensorapp.sensor

import kotlin.math.sqrt

/**
 * IMU-only Madgwick orientation filter. Accelerometer must contain gravity (m/s²),
 * gyroscope must be in rad/s, timestamps are used by the caller to calculate dt.
 * No magnetometer: yaw drift is not observable.
 * This is a revised implementation based on the original user's MadgwickAHRS.kt.
 */
class MadgwickAHRS(private val beta: Float = 0.1f) {
    var q0 = 1f; private set
    var q1 = 0f; private set
    var q2 = 0f; private set
    var q3 = 0f; private set

    fun reset() { q0 = 1f; q1 = 0f; q2 = 0f; q3 = 0f }

    fun updateIMU(gx: Float, gy: Float, gz: Float, ax: Float, ay: Float, az: Float, dt: Float): Boolean {
        if (!listOf(gx, gy, gz, ax, ay, az, dt).all { it.isFinite() } || dt <= 0f || dt > 0.1f) return false
        var d0 = .5f * (-q1 * gx - q2 * gy - q3 * gz)
        var d1 = .5f * ( q0 * gx + q2 * gz - q3 * gy)
        var d2 = .5f * ( q0 * gy - q1 * gz + q3 * gx)
        var d3 = .5f * ( q0 * gz + q1 * gy - q2 * gx)
        val aSq = ax * ax + ay * ay + az * az
        if (aSq > 1e-10f) {
            val an = 1f / sqrt(aSq)
            val x = ax * an; val y = ay * an; val z = az * an
            val q0q0 = q0*q0; val q1q1=q1*q1; val q2q2=q2*q2; val q3q3=q3*q3
            var s0 = 4*q0*(q1q1+q2q2) + 2*q2*x - 2*q1*y
            var s1 = 4*q1*q3q3 - 2*q3*x + 4*q0q0*q1 - 2*q0*y - 4*q1 + 8*q1*(q1q1+q2q2) + 4*q1*z
            var s2 = 4*q0q0*q2 + 2*q0*x + 4*q2*q3q3 - 2*q3*y - 4*q2 + 8*q2*(q1q1+q2q2) + 4*q2*z
            var s3 = 4*(q1q1+q2q2)*q3 - 2*q1*x - 2*q2*y
            val sSq = s0*s0+s1*s1+s2*s2+s3*s3
            // Exact aligned gravity produces zero gradient. Skip feedback, never divide by zero.
            if (sSq > 1e-12f && sSq.isFinite()) {
                val norm = 1f / sqrt(sSq)
                s0 *= norm; s1 *= norm; s2 *= norm; s3 *= norm
                d0 -= beta*s0; d1 -= beta*s1; d2 -= beta*s2; d3 -= beta*s3
            }
        }
        val n0=q0+d0*dt; val n1=q1+d1*dt; val n2=q2+d2*dt; val n3=q3+d3*dt
        val normSq=n0*n0+n1*n1+n2*n2+n3*n3
        if (normSq <= 1e-12f || !normSq.isFinite()) return false
        val inv=1f/sqrt(normSq)
        q0=n0*inv; q1=n1*inv; q2=n2*inv; q3=n3*inv
        return true
    }

    /** Expected gravity direction in device axes, normalized. */
    fun getGravityVector(): FloatArray = floatArrayOf(
        2f*(q1*q3-q0*q2),
        2f*(q0*q1+q2*q3),
        q0*q0-q1*q1-q2*q2+q3*q3
    )
}
