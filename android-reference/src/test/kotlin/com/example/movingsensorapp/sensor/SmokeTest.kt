package com.example.movingsensorapp.sensor

import kotlin.math.abs

fun main() {
    val f=MadgwickAHRS()
    repeat(1000) { check(f.updateIMU(0f,0f,0f,0f,0f,9.80665f,0.01f)) }
    check(listOf(f.q0,f.q1,f.q2,f.q3).all{it.isFinite()})
    check(abs(f.q0-1f)<0.0001f) { "Static orientation should stay identity" }
    check(!f.updateIMU(0f,0f,0f,0f,0f,9.8f,-1f))
    val p=MotionProcessor()
    check(p.update(1_000_000_000,0f,0f).dx==0f)
    val moved=p.update(1_010_000_000,2f,0f)
    check(moved.dx>0f) { "Positive X input should move right" }
    repeat(100){ val d=p.update(1_020_000_000L+it*10_000_000L,0f,0f);check(d.dx.isFinite()) }
    val fusion=ImuFusionEngine()
    fusion.onAccelerometer(1_000_000_000,0f,0f,9.80665f)
    check(fusion.onGyroscope(1_000_000_000,0f,0f,0f)==null)
    check(fusion.onGyroscope(1_010_000_000,0f,0f,0f)?.all{abs(it)<0.001f}==true)
    println("PASS: Madgwick finite/zero-gradient, pointer direction, static fusion")
}
