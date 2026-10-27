package com.example.movingsensorapp.sensor

import kotlin.math.sqrt

/**
 * Single time-base for orientation updates: call onGyroscope only for new gyro events,
 * using SensorEvent.timestamp (elapsed-realtime nanoseconds), not System.nanoTime().
 * Keeps the latest accelerometer-with-gravity measurement. All coordinates device-frame.
 */
class ImuFusionEngine(private val filter: MadgwickAHRS = MadgwickAHRS()) {
    private var ax=0f; private var ay=0f; private var az=0f
    private var accTimeNs: Long? = null
    private var lastGyroNs: Long? = null
    private var biasGx=0f; private var biasGy=0f; private var biasGz=0f

    fun reset() { filter.reset(); accTimeNs=null; lastGyroNs=null }
    fun setGyroscopeBias(gx: Float, gy: Float, gz: Float) { biasGx=gx; biasGy=gy; biasGz=gz }
    fun onAccelerometer(timestampNs: Long, x: Float, y: Float, z: Float) {
        if(listOf(x,y,z).all{it.isFinite()}) { ax=x; ay=y; az=z; accTimeNs=timestampNs }
    }
    /** Returns gravity-corrected acceleration if latest acceleration is fresh. */
    fun onGyroscope(timestampNs: Long, gx: Float, gy: Float, gz: Float): FloatArray? {
        val aTime=accTimeNs ?: return null
        if(timestampNs<aTime || timestampNs-aTime>50_000_000L) return null
        val prev=lastGyroNs; lastGyroNs=timestampNs
        if(prev==null) return null
        val dt=(timestampNs-prev)/1e9f
        if(!filter.updateIMU(gx-biasGx,gy-biasGy,gz-biasGz,ax,ay,az,dt))return null
        val gravity=filter.getGravityVector(); val g=9.80665f
        return floatArrayOf(ax-gravity[0]*g,ay-gravity[1]*g,az-gravity[2]*g)
    }
}
