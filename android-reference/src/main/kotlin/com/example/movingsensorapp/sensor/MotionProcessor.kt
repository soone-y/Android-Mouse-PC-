package com.example.movingsensorapp.sensor

import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.hypot

/** Independent of Android/Bluetooth: maps device-frame linear acceleration into pointer deltas. */
data class PointerSettings(
    val mode: Mode = Mode.DIRECT,
    val gain: Float = 80f, // DIRECT: pixels/s per m/s²; INTEGRATED: pixels per meter
    val deadZone: Float = 0.12f, // m/s²
    val smoothingHz: Float = 12f,
    val frictionPerSecond: Float = 8f,
    val stationaryAcceleration: Float = 0.08f,
    val stationaryHoldSeconds: Float = 0.15f,
    val invertX: Boolean = false,
    val invertY: Boolean = false
) {
    enum class Mode { DIRECT, INTEGRATED }
}

data class PointerDelta(val dx: Float, val dy: Float, val stationary: Boolean)

class MotionProcessor(var settings: PointerSettings = PointerSettings()) {
    private var lastNs: Long? = null
    private var smoothX = 0f; private var smoothY = 0f
    private var velocityX = 0f; private var velocityY = 0f
    private var stableSeconds = 0f

    fun reset() { lastNs=null; smoothX=0f; smoothY=0f; velocityX=0f; velocityY=0f; stableSeconds=0f }

    fun update(timestampNs: Long, ax: Float, ay: Float): PointerDelta {
        if (!ax.isFinite() || !ay.isFinite()) return PointerDelta(0f,0f,false)
        val previous=lastNs; lastNs=timestampNs
        if (previous==null) return PointerDelta(0f,0f,false)
        val dt=(timestampNs-previous)/1e9f
        if (dt <= 0f || dt > 0.1f) { reset(); lastNs=timestampNs; return PointerDelta(0f,0f,false) }
        val c=settings
        val alpha=(1f-exp(-2f*Math.PI.toFloat()*c.smoothingHz.coerceAtLeast(0f)*dt)).coerceIn(0f,1f)
        smoothX+=alpha*(ax-smoothX); smoothY+=alpha*(ay-smoothY)
        val stationary = hypot(ax,ay) < c.stationaryAcceleration
        stableSeconds = if(stationary) stableSeconds+dt else 0f
        val settled=stableSeconds>=c.stationaryHoldSeconds
        fun deadZone(v: Float): Float = if(abs(v)<=c.deadZone) 0f else v-kotlin.math.sign(v)*c.deadZone
        val x=deadZone(smoothX)*(if(c.invertX) -1f else 1f)
        val y=deadZone(smoothY)*(if(c.invertY) -1f else 1f)
        if(c.mode==PointerSettings.Mode.DIRECT) {
            return PointerDelta(x*c.gain*dt,y*c.gain*dt,settled)
        }
        if(settled) { velocityX=0f; velocityY=0f }
        else {
            velocityX+=x*dt; velocityY+=y*dt
            val damping=exp(-c.frictionPerSecond.coerceAtLeast(0f)*dt)
            velocityX*=damping; velocityY*=damping
        }
        // An experimental velocity integration, NOT trustworthy absolute position tracking.
        return PointerDelta(velocityX*c.gain*dt,velocityY*c.gain*dt,settled)
    }
}
